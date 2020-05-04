import { MongoClient, Db } from 'mongodb';

const UTILITY = 'utility';
const ONION = 'onion';

export class MongoDB {
    private static instance: MongoDB;

    private utilityDb: Db;
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
        this.utilityDb = mongodbClient.db(UTILITY);
        this.onionDb = mongodbClient.db(ONION);
    }
}