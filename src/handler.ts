import { MongoDB } from "./drivers/database/mongodb";

const request = require('request-promise');
const { Client } = require('@elastic/elasticsearch');
const AWS = require('aws-sdk');

// Dotenv setup
require('dotenv').config();

let client, s3;

//@ts-ignore
export const changeObjectAuthorHandler = async (event, context, callback) => {
    client = setupElasticsearch();
    s3 = setupAWS();

    // event.body gets the body of the request
    // body will be structured as such: {
    //      from:       ID of the person to transfer from
    //      to:         ID of the person to transfer to
    //      objectIDs:  Array of object IDs to change
    // }
    const { fromUserID, toUserID, objectIDs } = JSON.parse(event.body);

    const db = await MongoDB.getInstance();

    let fromObjects = await db.getAuthorLearningObjects(fromUserID, objectIDs);
    let toObjects = await db.getAuthorLearningObjects(toUserID);
    let newAuthor = await db.getUserAccount(toUserID);
    let oldAuthor = await db.getUserAccount(fromUserID);
    let newAuthorAccessID = await db.getFileAccessID(newAuthor.username);
    let oldAuthorAccessID = await db.getFileAccessID(oldAuthor.username);

    fromObjects.map(async learningObject => {
        const cuid = learningObject.cuid;
        await copyFiles(null, cuid, oldAuthorAccessID, newAuthorAccessID);
    });

    await db.updateLearningObjectAuthor(fromUserID, toUserID);

    fromObjects.map(async learningObject => {
        const learningObjectID = learningObject._id;
        await deleteSearchIndexItem(learningObjectID);
    });

    toObjects.map(async learningObject => {
        let contributors = [];
        for(let j=0; j < learningObject.contributors.length; j++) {
            const author = await db.getUserAccount(learningObject.contributors[j]);
            contributors.push(author);
        }
        if(learningObject.outcomes !== undefined) {
            for(let p=0; p < learningObject.outcomes.length; p++) {
                learningObject.outcomes[p] = {...learningObject.outcomes[p], mappings: []};
            }
        } else {
            learningObject.outcomes = [];
        }
        await insertSearchIndexItem({ ...learningObject, author: newAuthor });
    });

    await updateLearningObjectReadMes(toObjects);
};

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
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        region: process.env.AWS_REGION
    };
    
    AWS.config.credentials = AWS_SDK_CONFIG.credentials;
    AWS.region = AWS_SDK_CONFIG.region;
    
    return new AWS.S3();
}

async function copyFiles(token, fromCuid, oldAuthorAccessID, newAuthorAccessID) {
    const s3Options = { Bucket: process.env.BUCKET_NAME, Prefix: `${oldAuthorAccessID.fileAccessId}/${fromCuid}` };
    if(token) {
        s3Options['ContinuationToken'] = token;
    }

    let allKeys = [];
    s3.listObjectsV2(s3Options, function(err, data) {
        allKeys = allKeys.concat(data.Contents);
    
        if(data.IsTruncated)
            copyFiles(data.NextContinuationToken, fromCuid, oldAuthorAccessID, newAuthorAccessID);
        else {
            allKeys.map(async key => {
                if (!key.Key.includes(`${fromCuid}.zip`)) {
                    console.log('OLD KEY: ', key.Key);
                    console.log('NEW KEY: ', `${newAuthorAccessID.fileAccessId}${key.Key.replace(oldAuthorAccessID.fileAccessId, '')}`);
                    await s3.copyObject({
                        Bucket: process.env.BUCKET_NAME,
                        CopySource: `${process.env.BUCKET_NAME}/${key.Key}`,  // old file Key
                        Key: `${newAuthorAccessID.fileAccessId}${key.Key.replace(oldAuthorAccessID.fileAccessId, '')}`, // new file Key
                    }).promise();
                }
            });
        }
    });
}

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
    } catch (e) {
        console.error(e.meta.body.error);
    }
}

async function insertSearchIndexItem(learningObject) {
    try {
        await client.index({
            index: 'learning-objects',
            type: '_doc',
            body: formatLearningObjectSearchDocument(learningObject),
        });
    } catch (e) {
        console.error(e.meta.body.error);
    }
}

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

async function updateLearningObjectReadMes(toObjects) {
    toObjects.map(async learningObject => {
        const learningObjectID = learningObject._id;
        const options = {
            uri: `${process.env.LEARNING_OBJECT_API}/learning-objects/${learningObjectID}/pdf`,
            headers: {
                Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVhOTU4MzQwMTQwNWNiMDUzMjcyY2VkMSIsInVzZXJuYW1lIjoibnZpc2FsMSIsIm5hbWUiOiJuaWNob2xhcyB2aXNhbGxpIiwiZW1haWwiOiJudmlzYWwxQHN0dWRlbnRzLnRvd3Nvbi5lZHUiLCJvcmdhbml6YXRpb24iOiJ0b3dzb24gdW5pdmVyc2l0eSIsImVtYWlsVmVyaWZpZWQiOnRydWUsImFjY2Vzc0dyb3VwcyI6WyJhZG1pbiIsIiJdLCJpYXQiOjE1NzYyNDk0NDgsImV4cCI6MTU3NjMzNTg0OCwiYXVkIjoibnZpc2FsMSIsImlzcyI6IlRISVNfSVNfQU5fSVNTVUVSIn0.22qf_be65nj1wq6lVD4KRTKiU2q4VvmSBWNk4fyKQbY',
            },
            method: 'PATCH',
        };
        await request(options);
    });
}