const AWS = require('aws-sdk');

async function scan(docClient, { params, updateFn }) {
  const { Items, LastEvaluatedKey } = await docClient.scan(params).promise();

  await Items.reduce((prev, item) => prev.then(() => updateFn(item)), Promise.resolve());

  if (!LastEvaluatedKey) {
    return;
  }

  await scan({
    ...params,
    ExclusiveStartKey: LastEvaluatedKey,
  });
}

async function stream(streamClient, { streamARN, updateFn }) {
  const {
    StreamDescription: { Shards },
  } = await streamClient.describeStream({ StreamArn: streamARN }).promise();

  async function readRecords(ShardIterator) {
    const { Records, NextShardIterator } = await streamClient.getRecords({ ShardIterator }).promise();

    await Records.reduce((prev, item) => prev.then(() => updateFn(item)), Promise.resolve());

    if (!Records.length || !NextShardIterator) {
      return;
    }

    await readRecords(NextShardIterator);
  }

  await Shards.reduce(async (prev, { ShardId }) => {
    await prev;
    const { ShardIterator } = await streamClient
      .getShardIterator({
        ShardId,
        StreamArn: streamARN,
        ShardIteratorType: 'TRIM_HORIZON',
      })
      .promise();
    await readRecords(ShardIterator);
  }, Promise.resolve());
}

exports.up = async function up({ docClient, streamClient }, { outputTable, streamARN }) {
  await scan(docClient, {
    params: {
      TableName: outputTable,
      FilterExpression: 'attribute_exists(test)',
    },
    async updateFn(item) {
      const params = {
        TableName: outputTable,
        Key: { id: item.id },
        UpdateExpression: 'SET tests = :tests REMOVE test',
        ExpressionAttributeValues: {
          ':tests': item.test,
        },
      };

      await docClient.update(params).promise();
    },
  });

  await stream(streamClient, {
    streamARN,
    async updateFn(item) {
      if (item.eventName === 'INSERT') {
        const updatedItem = AWS.DynamoDB.Converter.unmarshall(item.dynamodb.NewImage);
        updatedItem.tests = updatedItem.test;
        delete updatedItem.test;

        await docClient
          .put({
            TableName: outputTable,
            Item: updatedItem,
          })
          .promise();
      }
    },
  });
};

exports.down = async function down({ docClient, streamClient }, { outputTable, streamARN }) {
  await scan(docClient, {
    params: {
      TableName: outputTable,
      FilterExpression: 'attribute_exists(tests)',
    },
    async updateFn(item) {
      const params = {
        TableName: outputTable,
        Key: { id: item.id },
        UpdateExpression: 'SET test = :test REMOVE tests',
        ExpressionAttributeValues: {
          ':test': item.tests,
        },
      };

      await docClient.update(params).promise();
    },
  });

  await stream(streamClient, {
    streamARN,
    async updateFn(item) {
      if (item.eventName === 'INSERT') {
        const updatedItem = AWS.DynamoDB.Converter.unmarshall(item.dynamodb.NewImage);
        updatedItem.test = updatedItem.tests;
        delete updatedItem.tests;

        await docClient
          .put({
            TableName: outputTable,
            Item: updatedItem,
          })
          .promise();
      }
    },
  });
};
