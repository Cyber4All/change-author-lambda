import { MongoClient, Db } from 'mongodb';

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
            await this.connect(process.env.CLARK_DB_URI);
        }
        return this.instance;
    }

    /**
     * Connects to the DB given a String URI
     * @param dbURI String, The DB URI to connect to
     */
    private static async connect(dbURI: string) {
        const mongodbClient = await new MongoClient(dbURI, { useNewUrlParser: true }).connect();
        this.instance = new MongoDB();
        this.instance.setDatabase(mongodbClient);
    }

    /**
     * Sets the databases
     * @param mongodbClient The connection client to MongoDB
     */
    private setDatabase(mongodbClient: MongoClient) {
        this.onionDb = mongodbClient.db(ONION);
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
    async getAuthorLearningObjects(authorID: string, objectIDs?:string[]) {
        // Build the author learning object query
        let query = { };
        if (objectIDs) {
            query = {"$and": [{ authorID },{ _id: { "$in": objectIDs }}]};
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
        return await this.onionDb.collection('file-access-ids').findOne({ username });
    }
}