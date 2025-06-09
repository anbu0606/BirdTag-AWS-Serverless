const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'ap-southeast-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    let thumbnailUrl = '';
    
    // Handle only POST requests
    if (event.httpMethod === 'POST') {
      // Parse JSON body: {"thumbnailUrl": "https://..."}
      const body = JSON.parse(event.body || '{}');
      thumbnailUrl = body.thumbnailUrl || body.thumbnail_url || '';
    } else {
      // Method not allowed
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

    // Validate thumbnail URL
    if (!thumbnailUrl || !thumbnailUrl.trim()) {
      return {
        statusCode: 400,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'No thumbnail URL provided. Use POST request with JSON body {"thumbnailUrl": "https://..."}.' 
        }),
      };
    }

    // Normalize the thumbnail URL (handle both s3:// and https:// formats)
    const normalizedThumbnailUrl = normalizeThumbnailUrl(thumbnailUrl.trim());
    
    console.log('Searching for thumbnail URL:', normalizedThumbnailUrl);
    console.log('Original input URL:', thumbnailUrl);

    // Query the birds_table to find matching thumbnail URL
    const scanParams = {
      TableName: 'birds_table',
      FilterExpression: 'attribute_exists(s3_thumbnail_url) AND file_type = :imageType',
      ExpressionAttributeValues: {
        ':imageType': 'image'
      }
    };

    console.log('Scanning DynamoDB with params:', JSON.stringify(scanParams));
    const command = new ScanCommand(scanParams);
    const result = await dynamodb.send(command);
    console.log(`Found ${result.Items.length} image files in database`);

    // Search for matching thumbnail URL
    let matchingFile = null;
    
    for (const file of result.Items) {
      // Get the thumbnail URL from the file
      let fileThumbnailUrl = '';
      if (file.s3_thumbnail_url) {
        fileThumbnailUrl = normalizeThumbnailUrl(file.s3_thumbnail_url);
      }
      
      console.log(`Checking file ${file.id}: ${fileThumbnailUrl}`);
      
      // Check if URLs match (exact match or normalized match)
      if (fileThumbnailUrl === normalizedThumbnailUrl || 
          file.s3_thumbnail_url === thumbnailUrl ||
          areUrlsEquivalent(fileThumbnailUrl, normalizedThumbnailUrl)) {
        matchingFile = file;
        console.log('✓ Found matching file:', file.id);
        break;
      }
    }

    if (!matchingFile) {
      return {
        statusCode: 404,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: 'No file found with the provided thumbnail URL.',
          searchedUrl: thumbnailUrl,
          normalizedUrl: normalizedThumbnailUrl
        }),
      };
    }

    // Fix S3 URLs if needed
    const fullSizeUrl = fixS3Url(matchingFile.s3_url);
    const thumbnailUrlFixed = fixS3Url(matchingFile.s3_thumbnail_url);

    // Parse detected birds information
    let detectedBirds = {};
    if (Array.isArray(matchingFile.tags) && Array.isArray(matchingFile.counts)) {
      matchingFile.tags.forEach((species, index) => {
        if (species && matchingFile.counts[index] !== undefined) {
          detectedBirds[species.toLowerCase()] = matchingFile.counts[index];
        }
      });
    }

    // Return the file information
    return {
      statusCode: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: true,
        fullSizeUrl: fullSizeUrl,
        thumbnailUrl: thumbnailUrlFixed,
        fileInfo: {
          fileName: matchingFile.file_name,
          fileId: matchingFile.id,
          uploadDate: matchingFile.timestamp,
          detectedBirds: detectedBirds
        },
        message: 'Full-size image URL found successfully.'
      }),
    };

  } catch (error) {
    console.error('Search error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Internal server error during search',
        details: error.message 
      }),
    };
  }
};

// Helper function to normalize thumbnail URLs for comparison
function normalizeThumbnailUrl(url) {
  if (!url) return '';
  
  // Convert s3:// to https://
  if (url.startsWith('s3://')) {
    const s3Match = url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (s3Match) {
      const bucketName = s3Match[1];
      const objectKey = s3Match[2];
      return `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${objectKey}`;
    }
  }
  
  // Remove trailing slashes and normalize
  return url.toLowerCase().replace(/\/+$/, '');
}

// Helper function to fix S3 URLs
function fixS3Url(url) {
  if (!url) return url;
  if (url.startsWith('s3://')) {
    const s3Match = url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (s3Match) {
      const bucketName = s3Match[1];
      const objectKey = s3Match[2];
      return `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${objectKey}`;
    }
  }
  return url;
}

// Helper function to check if URLs are equivalent
function areUrlsEquivalent(url1, url2) {
  if (!url1 || !url2) return false;
  
  // Remove protocol differences and normalize
  const normalize = (url) => url.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^s3:\/\//, '')
    .replace(/\/+$/, '');
  
  return normalize(url1) === normalize(url2);
}