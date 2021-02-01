const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
});

const docClient = new AWS.DynamoDB.DocumentClient({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
});

async function createTables() {
  await dynamo
    .createTable({
      TableName: 'to-be-renamed',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    })
    .promise();

  await dynamo
    .createTable({
      TableName: 'after-rename',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    })
    .promise();

  await dynamo
    .createTable({
      TableName: 'migrations',
      AttributeDefinitions: [
        {
          AttributeName: 'name',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'name',
          KeyType: 'HASH',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    })
    .promise();

  await dynamo.listTables().promise();
}

async function insertItems() {
  const ids = [`A${Date.now()}`, `B${Date.now()}`, `C${Date.now()}`];

  await ids.reduce(
    (prev, id) =>
      prev.then(() =>
        docClient
          .put({
            TableName: 'to-be-renamed',
            Item: { id, test: ['test.1', 'test.2'] },
          })
          .promise(),
      ),
    Promise.resolve(),
  );

  await ids.reduce(
    (prev, id) =>
      prev.then(() =>
        docClient
          .put({
            TableName: 'after-rename',
            Item: { id, test: ['test.1', 'test.2'] },
          })
          .promise(),
      ),
    Promise.resolve(),
  );
}

async function startStreamAndAddFewItems() {
  const res = await dynamo
    .updateTable({
      TableName: 'to-be-renamed',
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: 'NEW_AND_OLD_IMAGES',
      },
    })
    .promise();

  const ids = [`D${Date.now()}`, `E${Date.now()}`, `F${Date.now()}`];

  await ids.reduce(
    (prev, id) =>
      prev.then(() =>
        docClient
          .put({
            TableName: 'to-be-renamed',
            Item: { id, test: ['test.2', 'test.3'] },
          })
          .promise(),
      ),
    Promise.resolve(),
  );

  console.log('Stream ARN: ', res.TableDescription.LatestStreamArn);
}

async function setup() {
  await createTables();

  await insertItems();

  await startStreamAndAddFewItems();
}

setup();
