import { MongoDB } from "./drivers/database/mongodb";

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
    const fromUserID = '';
    const toUserID = '';
    const objectIDs = [];

    const db = await MongoDB.getInstance();

    let fromObjects = await db.getAuthorLearningObjects(fromUserID, objectIDs);
    let newAuthor = await db.getUserAccount(toUserID);
    let oldAuthor = await db.getUserAccount(fromUserID);
    let newAuthorAccessID = await db.getFileAccessID(newAuthor.username);
    let oldAuthorAccessID = await db.getFileAccessID(oldAuthor.username);

    fromObjects.map(async learningObject => {
        const cuid = learningObject.cuid;
        await copyFiles(null, cuid, oldAuthorAccessID, newAuthorAccessID);
    });
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