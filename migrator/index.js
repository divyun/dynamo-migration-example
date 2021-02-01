const path = require('path');
const fs = require('fs');
const AWS = require('aws-sdk');
const { Umzug } = require('umzug');

const docClient = new AWS.DynamoDB.DocumentClient({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
});

const streamClient = new AWS.DynamoDBStreams({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
});

const { MIGRATION_TABLE: tableName, DYNAMO_OUTPUT_TABLE: outputTable, DYNAMO_STREAM_ARN: streamARN } = process.env;

class DynamoDBStorage {
  constructor({ client, tableName }) {
    this.client = client;
    this.tableName = tableName;
  }

  async logMigration(migrationName) {
    await this.client
      .put({ TableName: this.tableName, Item: { name: migrationName, createdAt: Date.now() } })
      .promise();
  }

  async unlogMigration(migrationName) {
    await this.client.delete({ TableName: this.tableName, Key: { name: migrationName } }).promise();
  }

  async scan(startKey) {
    const { Items, LastEvaluatedKey } = await this.client
      .scan({
        TableName: this.tableName,
        ExclusiveStartKey: startKey,
      })
      .promise();

    const result = Items.map(({ name }) => name);

    if (LastEvaluatedKey) {
      result.push(...this.scan(LastEvaluatedKey));
    }

    return result;
  }

  async executed() {
    const executedItems = await this.scan();

    return executedItems.sort();
  }
}

const migrator = new Umzug({
  storage: new DynamoDBStorage({ tableName, client: docClient }),
  migrations: {
    glob: 'migrations/*.js',
    resolve: ({ name, path }) => {
      const migration = require(path);
      return {
        name,
        up: async () => migration.up({ docClient, streamClient }, { outputTable, streamARN }),
        down: async () => migration.down({ docClient, streamClient }, { outputTable, streamARN }),
      };
    },
  },
  logger: console,
  create: {
    folder: 'migrations',
    template: (filepath) => [[filepath, fs.readFileSync(path.join(__dirname, 'template.js')).toString()]],
  },
});

migrator.runAsCLI();
