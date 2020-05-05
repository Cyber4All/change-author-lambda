import { MongoDB } from "./drivers/database/mongodb";

const { Client } = require('@elastic/elasticsearch')
const AWS = require('aws-sdk');

// Dotenv setup
require('dotenv').config()

//@ts-ignore
export const changeObjectAuthorHandler = async (event, context, callback) => {
    // event.body gets the body of the request
    // body will be structured as such: {
    //      from:       ID of the person to transfer from
    //      to:         ID of the person to transfer to
    //      objectIDs:  Array of object IDs to change
    // }
    const fromUserID = '';
    const toUserID = '';
    const objectIDs = [];

    const client = setupElasticsearch();
    const s3 = setupAWS();
    const db = await MongoDB.getInstance();

    let fromObjects = await db.getAuthorLearningObjects(fromUserID, objectIDs);
    let newAuthor = await db.getUserAccount(toUserID);
    let oldAuthor = await db.getUserAccount(fromUserID);
    let newAuthorAccessID = await db.getFileAccessID(newAuthor.username);
    let oldAuthorAccessID = await db.getFileAccessID(oldAuthor.username);
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