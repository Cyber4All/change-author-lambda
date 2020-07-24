// Set up an alert. if it fails. (sentry, cloudwatch alarm).

import { MongoDB } from './drivers/database/mongodb';
import request from 'request-promise';
import { generateServiceToken } from './drivers/jwt/tokenManager';
const { Client } = require('@elastic/elasticsearch');
const AWS = require('aws-sdk');
const async = require('async');
require('dotenv').config();

let client, s3;
let bucketName = process.env.BUCKET_NAME;

// @ts-ignore
export const changeObjectAuthorHandler = async (event, context, callback) => {
    try {
        const db = await MongoDB.getInstance();
        client = setupElasticsearch();
        s3 = setupAWS();

        // event.body gets the body of the request
        // body will be structured as such: {
        //      from:       ID of the person to transfer from
        //      to:         ID of the person to transfer to
        //      objectID:   ID of object ID to change
        // }

        const { fromUserID, toUserID, objectID } = JSON.parse(event.body);
        let fromObject = await db.getLearningObject(objectID); // returns the learning object that needs to be moved
        let oldAuthor = await db.getUserAccount(fromUserID);
        let newAuthor = await db.getUserAccount(toUserID);
        let oldAuthorAccessID = await db.getFileAccessID(oldAuthor.username);
        let newAuthorAccessID = await db.getFileAccessID(newAuthor.username);

        handleAuthorChange(objectID, toUserID, fromObject, oldAuthorAccessID, newAuthorAccessID, newAuthor);

        const response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Go Serverless v1.0! Change of authorship successfully!',
            }),
        };
        return context.succeed(response);
    } catch (error) {
        callback (error);
    }
};

async function handleAuthorChange(objectID: any, toUserID: any, fromObject: any[], oldAuthorAccessID: any, newAuthorAccessID: any, newAuthor: any) {
    try {
        updateMongoDoc(objectID, toUserID, fromObject); // changes authorship and adds previous author to contributors
        fromObject.map(async learningObject => {
            if (learningObject.status === 'released') {
                updateSearchIndex(fromObject, newAuthor);
            }
        });
        // All Learning Object files need to be copied to a new directory
        // Intentionally leave out bundles during copy so that new bundles
        // are created on next download
        fromObject.map(async (learningObject) => {
            const cuid = learningObject.cuid;
            console.log(cuid);
            await copyFiles(cuid, oldAuthorAccessID, newAuthorAccessID);
        });
        await updateLearningObjectReadMe(fromObject);
        // change authorship to new author if the parent object has children
        await moveLearningObjectChildren(fromObject, toUserID, objectID, oldAuthorAccessID, newAuthorAccessID);
    } catch (err) {
        throw err;
    }
}

// currently if the parent have children, they also get transfer to the new author. This dont not work the other way around
// Therfore if a child's object is being transfered, its parent will not be moved but if it has children, they would be.
async function updateMongoDoc (
    objectID: string,
    toUserID: string,
    fromObject,
    ) {
    try {
        const db = await MongoDB.getInstance();
        await db.updateLearningObjectAuthor(objectID, toUserID); // change authorship
        fromObject.map(async learningObject => {
            const authorID = learningObject.authorID;
            const contributors = [learningObject.contributors];
            if (contributors.length > 0 ) {
                contributors.forEach(async value => {
                    if (!value.includes(authorID)) {
                    await db.addAuthorToContributor(objectID, authorID); // Adds previous author to contributor
                    }
                });
            } else {
                await db.addAuthorToContributor(objectID, learningObject.authorID); // Adds previous author to contributor
            }
        });
    } catch (err) {
        throw err;
    }
}

/**
 * Sets up the connection to the elastic search domain index
 */
function setupElasticsearch() {
    return new Client({ node: process.env.ELASTIC_SEARCH_DOMAIN });
}

/**
 * Sets up the connection to the Clark AWS file bucket
 */
function setupAWS() {
    const AWS_SDK_CONFIG = {
        credentials: {
            accessKeyId: process.env.ACCKEY, // AWS_ACCESS_KEY
            secretAccessKey: process.env.SECKEY, // AWS_SECRET_KEY
        },
        region: process.env.REG, // AWS_REGION
    };

    AWS.config.credentials = AWS_SDK_CONFIG.credentials;
    AWS.region = AWS_SDK_CONFIG.region;

    if (process.env.MODE === 'dev') {
        return new AWS.S3({ endpoint: process.env.LOCALSTACK_ENDPOINT_S3, s3ForcePathStyle: true });
    } else {
        return new AWS.S3({endpoint: process.env.DEV_ENDPOINT_S3, params: {Bucket: bucketName}, region: 'us-east-1'});
    }
}

/**
 * Copies files in s3 to location of new author
 * @param token token for multipart file uploads
 * @param fromCuid the cuid of the object to move
 * @param oldAuthorAccessID the file access id of the old author
 * @param newAuthorAccessID the file access id of the new author
 */

 // Know what files failed. add visibility.
async function copyFiles(fromCuid, oldAuthorAccessID, newAuthorAccessID) {
    const oldPrefix = `${oldAuthorAccessID.fileAccessId}/${fromCuid}`;
    const newPrefix = `${newAuthorAccessID.fileAccessId}/${fromCuid}`;
    console.log(oldPrefix);

    try {
        s3.listObjectsV2({Prefix: oldPrefix}, function (err, data) {
            if (err) {
                console.log(err, err.stack); // logs if an error occurs
            } else {
                console.log(data);
            }
            if (data.Contents.length) {
                async.each(data.Contents, function(file, cb) {
                    if (!file.Key.includes(`${fromCuid}.zip`)
                    && !file.Key.includes('bundle.zip')
                    && !file.Key.includes('0ReadMeFirst - ')) {
                        const copyParams = {
                            Bucket: bucketName,
                            CopySource: bucketName + '/' + file.Key,
                            Key: file.Key.replace(oldPrefix, newPrefix),
                        };
                        const deleteParms = {
                            Bucket: bucketName,
                            Key: file.Key,
                        };
                        s3.copyObject(copyParams, function(copyErr, copyData) {
                            if (!copyErr) {
                                s3.deleteObject(deleteParms, (e) => {
                                    if (!e) {
                                        console.log('File has been deleted successfully');
                                    } else {
                                        console.log(e);
                                    }
                                });
                                console.log (copyData);
                            } else {
                                throw err;
                            }
                            cb();
                        });
                    }
                });
            }
        });
    } catch (err) {
        throw err;
    }
}

/**
 * Updates the search index in elastic to reflect author change
 * @param fromObjects objects that were changed
 * @param toObjects objects that are being added to
 * @param newAuthor the new author of the objects
 */
async function updateSearchIndex(fromObject, newAuthor) {
    try {
        const db = await MongoDB.getInstance();
        fromObject.map(async learningObject => {
            const learningObjectID = learningObject._id;
            await deleteSearchIndexItem(learningObjectID);
        });
        fromObject.map(async learningObject => {
            let contributors = [];
            for (let j = 0; j < learningObject.contributors.length; j++) {
                const author = await db.getUserAccount(learningObject.contributors[j]);
                contributors.push(author);
            }
            const learningObjectOutcomes = await db.getOutcome(learningObject._id);
            learningObjectOutcomes.map(async outcome => {
                const mappings = outcome.mappings;
                if (mappings.length) {
                    let guildline = [];
                    for (let i = 0; i < mappings.length; i++) {
                        const payload = await db.getGuildlines(mappings[i]);
                        guildline.push(payload);
                    }
                } else {
                    outcome.mappings = [];
                }
            });
            await insertSearchIndexItem({ ...learningObject, author: newAuthor, contributors: contributors});
        });
    } catch (err) {
        throw err;
    }
}

/**
 * Deletes the search index of the object in elastic
 * @param learningObjectID the object id to delete
 */
async function deleteSearchIndexItem(learningObjectID) {
    try {
        await client.deleteByQuery({
            index: 'learning-objects',
            body: {
                query: {
                bool: {
                    must: [
                    {
                        match: { id: learningObjectID },
                    },
                    ],
                },
                },
            },
        });
    } catch (err) {
        throw err;
    }
}

/**
 * Inserts new search index of a learning object into elastic
 * @param learningObject the object to add
 */
async function insertSearchIndexItem(learningObject) {
    try {
        await client.index({
            index: 'learning-objects',
            type: '_doc',
            body: formatLearningObjectSearchDocument(learningObject),
        });
    } catch (err) {
        throw err;
    }
}

/**
 * Formats the object search document to the standardization we use in
 * elastic
 * @param learningObject the object to standardize
 */
function formatLearningObjectSearchDocument(
    learningObject,
  ) {
    const learningObjectSearchDocument = {
      author: {
        name: learningObject.author.name,
        username: learningObject.author.username,
        email: learningObject.author.email,
        organization: learningObject.author.organization,
      },
      collection: learningObject.collection,
      contributors: learningObject.contributors.map(c => ({
        name: c.name,
        username: c.username,
        email: c.email,
        organization: c.organization,
      })),
      date: learningObject.date,
      description: learningObject.description,
      cuid: learningObject.cuid,
      id: learningObject._id,
      length: learningObject.length,
      levels: learningObject.levels,
      name: learningObject.name,
      outcomes: learningObject.outcomes,
      version: learningObject.version,
      status: learningObject.status,
    };
    return learningObjectSearchDocument;
}

/**
 * Updates the learning object ReadMes to reflect the new author
 * change
 * @param toObjects The objects updated
 */
async function updateLearningObjectReadMe(fromObject: any) {
    try {
        fromObject.map(async learningObject => {
            const learningObjectID = learningObject._id;
            const options = {
                uri: `${process.env.LEARNING_OBJECT_API}/learning-objects/${learningObjectID}/pdf`,
                headers: {
                    Authorization: `Bearer ${generateServiceToken()}`,
                },
                method: 'PATCH',
            };
            request(options);
        });

    } catch (err) {
        throw err;
    }
}

/**
 * Change authorship of objects if it has children
 * @param fromObjects objects that were changed
 * @param newAuthorID id the new author
 */
async function moveLearningObjectChildren (fromObject: any, toUserID: string, objectID: string, oldAuthorAccessID, newAuthorAccessID) {
    const db = await MongoDB.getInstance();
    try {
        fromObject.forEach(async learningObject => {
            if (learningObject.children && learningObject.children.length) {
                for (const childID of learningObject.children) {
                    const objects = await db.getLearningObject(childID);
                    updateMongoDoc(childID, toUserID, objects); // changes authorship and adds previous author to contributors
                    objects.map(async e => {
                        if ( e.status === 'released') {
                            await updateSearchIndex(objects, toUserID);
                        }
                    });
                    objects.map(async (value) => {
                        const cuid = value.cuid;
                        await copyFiles(cuid, oldAuthorAccessID, newAuthorAccessID);
                    });
                    await updateLearningObjectReadMe(objects);
                    if (objects[0].children) {
                        await moveLearningObjectChildren(objects, toUserID, objects[0]._id, oldAuthorAccessID, newAuthorAccessID);
                    }
                }
            }
        });
        return;
    } catch (err) {
        throw err;
    }
}
