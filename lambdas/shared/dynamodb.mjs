import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const BATCH_GET_MAX_RETRIES = 5;
const BATCH_GET_INITIAL_DELAY_MS = 50;
const BATCH_GET_MAX_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getItem(tableName, key) {
  const { Item } = await docClient.send(new GetCommand({ TableName: tableName, Key: key }));
  return Item;
}

export async function putItem(tableName, item) {
  await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

export async function deleteItem(tableName, key) {
  await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
}

export async function updateItem(tableName, key, updateExpression, expressionValues, expressionNames) {
  const params = {
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  };
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }
  const { Attributes } = await docClient.send(new UpdateCommand(params));
  return Attributes;
}

export async function scan(tableName, filterExpression, expressionValues, expressionNames) {
  const params = { TableName: tableName };
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeValues = expressionValues;
  }
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }

  const items = [];
  let lastKey;
  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new ScanCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

export async function query(tableName, indexName, keyCondition, expressionValues, expressionNames) {
  const params = {
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
  };
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }

  const items = [];
  let lastKey;
  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new QueryCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

export async function batchGet(tableName, keys) {
  if (!keys.length) return [];

  const chunks = [];
  for (let i = 0; i < keys.length; i += 100) {
    chunks.push(keys.slice(i, i + 100));
  }

  const items = [];
  for (const chunk of chunks) {
    let currentKeys = chunk;
    let retries = 0;

    while (currentKeys.length > 0) {
      const { Responses, UnprocessedKeys } = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: { Keys: currentKeys },
          },
        })
      );
      items.push(...(Responses?.[tableName] || []));

      const unprocessed = UnprocessedKeys?.[tableName]?.Keys;
      if (!unprocessed?.length) break;

      if (retries >= BATCH_GET_MAX_RETRIES) {
        console.warn(
          `batchGet: max retries (${BATCH_GET_MAX_RETRIES}) reached for table ${tableName}, ${unprocessed.length} keys unprocessed`
        );
        break;
      }

      const delayMs = Math.min(
        BATCH_GET_MAX_DELAY_MS,
        BATCH_GET_INITIAL_DELAY_MS * Math.pow(2, retries)
      );
      await sleep(delayMs);
      currentKeys = unprocessed;
      retries += 1;
    }
  }
  return items;
}
