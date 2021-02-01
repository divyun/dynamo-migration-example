async function scan(docClient, { params, updateFn }) {
  const { Items, LastEvaluatedKey } = await docClient.scan(params, onScan).promise();

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
    const { Records, NextShardIterator } = await streamClient.getRecords(ShardIterator);

    await Records.reduce((prev, item) => prev.then(() => updateFn(item)), Promise.resolve());

    await readRecords(NextShardIterator);
  }

  await Shards.reduce(async (prev, { ShardId }) => {
    await prev;
    const { ShardIterator } = await streamClient.getShardIterator({
      ShardId,
      StreamArn: streamARN,
    });
    await readRecords(ShardIterator);
  }, Promise.all());
}

exports.up = async function up({ docClient, streamClient }, { outputTable, streamARN }) {
  await scan(docClient, {
    params: { TableName: outputTable },
    async updateFn(item) {},
  });

  console.log('Start streaming');

  await stream(streamClient, { streamARN, async updateFn() {} });
};

exports.down = async function down({ docClient, streamClient }, { outputTable, streamARN }) {
  await scan(docClient, {
    params: { TableName: outputTable },
    async updateFn(item) {},
  });

  console.log('Start streaming');
  await stream(streamClient, { streamARN, async updateFn() {} });
};
