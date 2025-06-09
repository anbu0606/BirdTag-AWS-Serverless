const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const rawClient = new DynamoDBClient({ region: "ap-southeast-2" });
const docClient = DynamoDBDocumentClient.from(rawClient);
const BIRDS_TABLE = "birds_table";
const IDEMPOTENCY_TABLE = "idempotency_data";
exports.handler = async (event) => {
  try {
    let body;
    if (typeof event.body === "string") {
      body = JSON.parse(event.body);
    } else {
      body = event.body || event;
    }
    console.log("Parsed request body:", JSON.stringify(body, null, 2));
    const { url, operation, tags } = body;
    if (!Array.isArray(url) || typeof operation !== "number" || !Array.isArray(tags)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid input format" }),
        headers: { "Access-Control-Allow-Origin": "*" },
      };
    }
    const scanResult = await docClient.send(new ScanCommand({ TableName: BIRDS_TABLE }));
    for (const fileUrl of url) {
      const match = scanResult.Items.find(
        (item) => item.s3_url === fileUrl || item.s3_thumbnail_url === fileUrl
      );
      if (!match) {
        console.warn(`No match found for: ${fileUrl}`);
        continue;
      }
      const id = Number(match.id);
      const file_type = match.file_type;
      const idempotencyKey = {
        id,
        file_type,
      };
      // Check idempotency
      const existing = await docClient.send(
        new GetCommand({
          TableName: IDEMPOTENCY_TABLE,
          Key: idempotencyKey,
        })
      );
      if (existing.Item) {
        console.log(`Idempotent skip: ${id}-${file_type}`);
        continue;
      }
      // Proceed with tag operation
      let currentTags = match.tags || [];
      let currentCounts = match.counts || [];
      if (currentCounts.length < currentTags.length) {
        currentCounts = Array(currentTags.length).fill(1);
      }
      if (operation === 1) {
        // ADD tags
        for (let i = 0; i < tags.length; i += 2) {
          const tag = tags[i];
          const count = parseInt(tags[i + 1]) || 1;
          const index = currentTags.indexOf(tag);
          if (index >= 0) {
            currentCounts[index] += count;
          } else {
            currentTags.push(tag);
            currentCounts.push(count);
          }
        }
      } else if (operation === 0) {
        // REMOVE tags
        for (let i = 0; i < tags.length; i += 2) {
          const tag = tags[i];
          const count = parseInt(tags[i + 1]);
          const index = currentTags.indexOf(tag);

          if (count === 0) {
            // If count is 0, remove the tag if it exists
            if (index >= 0) {
              currentTags.splice(index, 1);
              currentCounts.splice(index, 1);
              console.log(`Removed tag "${tag}" because count is 0`);
            }
          } else {
            // Count is not 0, subtract from existing count
            if (index >= 0) {
              currentCounts[index] -= count;
              // If count becomes 0 or negative, remove the tag entirely
              if (currentCounts[index] <= 0) {
                currentTags.splice(index, 1);
                currentCounts.splice(index, 1);
                console.log(`Removed tag "${tag}" because count reached 0 or below`);
              }
            }
            // If tag doesn't exist, ignore (nothing to remove)
          }
        }
      }
       
      // Update bird record
      const updateParams = {
        TableName: BIRDS_TABLE,
        Key: { id, file_type },
        UpdateExpression: "SET tags = :tags, counts = :counts",
        ExpressionAttributeValues: {
          ":tags": currentTags,
          ":counts": currentCounts,
        },
      };
      console.log(`Updating bird record ID ${id} - ${file_type}`);
      await docClient.send(new UpdateCommand(updateParams));
      // Store idempotency entry with TTL (1 hour)
      const ttl = Math.floor(Date.now() / 1000) + 30;
      await docClient.send(
        new PutCommand({
          TableName: IDEMPOTENCY_TABLE,
          Item: {
            id,
            file_type,
            operation_creation: new Date().toISOString(),
            idempotency_expiration: ttl,
          },
        })
      );
      console.log(` Idempotency saved: ${id}-${file_type}`);
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Tags and counts updated successfully." }),
      headers: { "Access-Control-Allow-Origin": "*" },
    };
  } catch (err) {
    console.error("Lambda error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
      headers: { "Access-Control-Allow-Origin": "*" },
    };
  }
};