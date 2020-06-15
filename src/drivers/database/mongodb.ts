import { MongoClient, Db, ObjectID } from 'mongodb';
import 'dotenv/config';

const ONION = 'onion';


export class MongoDB {
    private static instance: MongoDB;

    private onionDb: Db;

    private constructor() {}

    /**
     * Gets an instance of the MongoDB connection
     */
    public static async getInstance() {
        if (!this.instance) {
            await this.connect();
        }
        return this.instance;
    }

    /**
     * Connects to the DB given a String URI
     * @param dbURI String, The DB URI to connect to
     */
    private static async connect() {
        // tslint:disable-next-line:max-line-length
        const mongodbClient = await new MongoClient('mongodb+srv://secinj:7800-York-Rd.@clarkdb-rktle.mongodb.net/onion?retryWrites=true&w=majority', { useNewUrlParser: true }).connect();
        this.instance = new MongoDB();
        this.instance.setDatabase(mongodbClient);
    }

    /**
     * Sets the databases
     * @param mongodbClient The connection client to MongoDB
     */
    private setDatabase(mongodbClient: MongoClient) {
        this.onionDb = mongodbClient.db();
    }

    /**
     * Gets the 'from' author's learning objects to change ownership
     *
     * If objectIDs is not present, all objects under the 'from' author
     * are returned
     *
     * @param authorID ID of the 'from' author
     * @param objectIDs Array of object IDs to change authorship
     */
    async getAuthorLearningObjects(authorID: string, objectIDs?: string[]) {
        // Build the author learning object query
        let query = { };
        if (objectIDs) {
            query = {'$and': [{ authorID }, { _id: { '$in': objectIDs }}]};
        } else {
            query = { authorID };
        }

        return await this.onionDb.collection('objects').find(query).toArray();
    }

    /**
     * Gets the user account from the database given the user ID
     * @param userID The user ID to fetch
     */
    async getUserAccount(userID: string) {
        return await this.onionDb.collection('users').findOne({ _id: userID });
    }

    /**
     * Gets the file access IDs for a user given a username
     * @param username the username of the file access ID to fetch
     */
    async getFileAccessID(username: string) {
        return await this.onionDb.collection('file-access-ids').findOne({ username: username });
    }

    /**
     * Updates the learning object author in the database
     * @param fromUserID the old author's id
     * @param toUserID the new author's id
     */
    async updateLearningObjectAuthor(objectIDs, toUserID) {
        return await this.onionDb.collection('objects').findOneAndUpdate({_id: objectIDs[0]}, {$set: {authorID: toUserID}}, {upsert: true});
    }
}

