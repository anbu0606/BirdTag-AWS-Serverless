const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

// Initialize clients
const dynamoClient = new DynamoDBClient({ region: 'ap-southeast-2' });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: 'ap-southeast-2' });

exports.handler = async (event) => {
  try {
    // Handle only POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'Method not allowed. Only POST requests are supported.' 
        }),
      };
    }

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: ''
      };
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'Invalid JSON in request body.' 
        }),
      };
    }

    // Validate input
    const { urls = [], fileIds = [] } = requestBody;
    
    if ((!urls || urls.length === 0) && (!fileIds || fileIds.length === 0)) {
      return {
        statusCode: 400,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'No URLs or file IDs provided. Send either "urls" array or "fileIds" array.' 
        }),
      };
    }

    console.log('Delete request received for:', { urls: urls.length, fileIds: fileIds.length });

    // Step 1: Find files in database based on URLs or IDs
    const filesToDelete = await findFilesToDelete(urls, fileIds);
    
    if (filesToDelete.length === 0) {
      return {
        statusCode: 404,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'No matching files found for deletion.',
          searchedUrls: urls,
          searchedIds: fileIds
        }),
      };
    }

    console.log(`Found ${filesToDelete.length} files to delete`);

    // Step 2: Delete files from S3 and database
    const deletionResults = await Promise.allSettled(
      filesToDelete.map(file => deleteFileCompletely(file))
    );

    // Step 3: Process results
    const successful = [];
    const failed = [];

    deletionResults.forEach((result, index) => {
      const file = filesToDelete[index];
      if (result.status === 'fulfilled') {
        successful.push({
          fileId: file.id,
          fileName: file.file_name,
          fileType: file.file_type,
          deletedFrom: result.value
        });
      } else {
        failed.push({
          fileId: file.id,
          fileName: file.file_name,
          error: result.reason.message
        });
      }
    });

    // Step 4: Return comprehensive results
    const response = {
      success: successful.length > 0,
      deleted: successful,
      failed: failed,
      summary: {
        totalRequested: filesToDelete.length,
        successfulDeletions: successful.length,
        failedDeletions: failed.length
      },
      message: `Successfully deleted ${successful.length} out of ${filesToDelete.length} files.`
    };

    const statusCode = failed.length === 0 ? 200 : (successful.length === 0 ? 500 : 207); // 207 = Multi-Status

    return {
      statusCode: statusCode,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Delete operation error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Internal server error during deletion',
        details: error.message 
      }),
    };
  }
};

// Find files to delete based on URLs or IDs
async function findFilesToDelete(urls, fileIds) {
  const filesToDelete = [];

  try {
    // Scan the entire table to find matching files
    const scanParams = {
      TableName: 'birds_table'
    };

    console.log('Scanning DynamoDB for files to delete...');
    const command = new ScanCommand(scanParams);
    const result = await dynamodb.send(command);
    
    console.log(`Scanned ${result.Items.length} total files in database`);

    // Filter files based on URLs or IDs
    for (const file of result.Items) {
      let shouldDelete = false;

      // Check if file ID matches
      if (fileIds.length > 0 && fileIds.includes(file.id)) {
        shouldDelete = true;
        console.log(`File ${file.id} marked for deletion by ID`);
      }

      // Check if any URL matches
      if (urls.length > 0) {
        const fileUrls = [
          file.s3_url,
          file.s3_thumbnail_url
        ].filter(url => url); // Remove null/undefined URLs

        // Normalize URLs for comparison
        const normalizedFileUrls = fileUrls.map(url => normalizeUrl(url));
        const normalizedSearchUrls = urls.map(url => normalizeUrl(url));

        for (const searchUrl of normalizedSearchUrls) {
          if (normalizedFileUrls.includes(searchUrl)) {
            shouldDelete = true;
            console.log(`File ${file.id} marked for deletion by URL: ${searchUrl}`);
            break;
          }
        }
      }

      if (shouldDelete) {
        filesToDelete.push(file);
      }
    }

    return filesToDelete;

  } catch (error) {
    console.error('Error finding files to delete:', error);
    throw error;
  }
}

// Delete a single file completely (from S3 and DynamoDB)
async function deleteFileCompletely(file) {
  const deletedFrom = [];
  
  try {
    console.log(`Deleting file ${file.id}: ${file.file_name}`);

    // Step 1: Delete main file from S3
    if (file.s3_url) {
      try {
        const mainS3Info = parseS3Url(file.s3_url);
        if (mainS3Info) {
          await deleteFromS3(mainS3Info.bucket, mainS3Info.key);
          deletedFrom.push(`S3: ${mainS3Info.bucket}/${mainS3Info.key}`);
          console.log(`✓ Deleted main file from S3: ${mainS3Info.key}`);
        }
      } catch (s3Error) {
        console.warn(`Failed to delete main file from S3: ${s3Error.message}`);
        // Continue with other deletions even if one fails
      }
    }

    // Step 2: Delete thumbnail from S3 (if it's an image)
    if (file.file_type === 'image' && file.s3_thumbnail_url) {
      try {
        const thumbS3Info = parseS3Url(file.s3_thumbnail_url);
        if (thumbS3Info) {
          await deleteFromS3(thumbS3Info.bucket, thumbS3Info.key);
          deletedFrom.push(`S3 Thumbnail: ${thumbS3Info.bucket}/${thumbS3Info.key}`);
          console.log(`✓ Deleted thumbnail from S3: ${thumbS3Info.key}`);
        }
      } catch (s3Error) {
        console.warn(`Failed to delete thumbnail from S3: ${s3Error.message}`);
        // Continue with database deletion even if thumbnail deletion fails
      }
    }

    // Step 3: Delete from DynamoDB
    console.log(`Attempting to delete item with ID: ${file.id} (type: ${typeof file.id})`);
    
    const deleteParams = {
      TableName: 'birds_table',
      Key: {
        id: Number(file.id),           // Partition key
        file_type: String(file.file_type)  // Sort key
      }
    };

    console.log('DynamoDB delete params:', JSON.stringify(deleteParams, null, 2));

    const deleteCommand = new DeleteCommand(deleteParams);
    await dynamodb.send(deleteCommand);
    deletedFrom.push(`DynamoDB: birds_table`);
    console.log(`✓ Deleted from DynamoDB: ${file.id}`);

    return deletedFrom;

  } catch (error) {
    console.error(`Error deleting file ${file.id}:`, error);
    throw error;
  }
}

// Delete object from S3
async function deleteFromS3(bucket, key) {
  const deleteParams = {
    Bucket: bucket,
    Key: key
  };

  const command = new DeleteObjectCommand(deleteParams);
  await s3Client.send(command);
}

// Parse S3 URL to extract bucket and key
function parseS3Url(url) {
  if (!url) return null;

  try {
    // Handle s3:// format
    if (url.startsWith('s3://')) {
      const match = url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (match) {
        return {
          bucket: match[1],
          key: match[2]
        };
      }
    }

    // Handle https:// format
    if (url.startsWith('https://')) {
      // Format: https://bucket-name.s3.region.amazonaws.com/key
      const match = url.match(/^https:\/\/([^.]+)\.s3\.[^.]+\.amazonaws\.com\/(.+)$/);
      if (match) {
        return {
          bucket: match[1],
          key: match[2]
        };
      }

      // Alternative format: https://s3.region.amazonaws.com/bucket-name/key
      const altMatch = url.match(/^https:\/\/s3\.[^.]+\.amazonaws\.com\/([^\/]+)\/(.+)$/);
      if (altMatch) {
        return {
          bucket: altMatch[1],
          key: altMatch[2]
        };
      }
    }

    console.warn(`Could not parse S3 URL: ${url}`);
    return null;

  } catch (error) {
    console.error(`Error parsing S3 URL ${url}:`, error);
    return null;
  }
}

// Normalize URL for comparison
function normalizeUrl(url) {
  if (!url) return '';
  
  // Convert s3:// to https:// format for consistent comparison
  if (url.startsWith('s3://')) {
    const s3Info = parseS3Url(url);
    if (s3Info) {
      return `https://${s3Info.bucket}.s3.ap-southeast-2.amazonaws.com/${s3Info.key}`;
    }
  }
  
  return url.toLowerCase().replace(/\/+$/, ''); // Remove trailing slashes
}