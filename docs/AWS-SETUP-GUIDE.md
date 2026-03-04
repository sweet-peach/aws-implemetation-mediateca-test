# Mediateca - AWS Manual Setup Guide

This guide walks you through setting up all required AWS services from scratch using the AWS Console. Follow the steps in order, as later steps depend on outputs from earlier ones.

**Prerequisites:**
- An AWS account
- AWS Console access with admin permissions
- Choose a region (recommended: `eu-west-1` Ireland, since users are in Spain)

> Keep a notepad open to save values you'll need later (marked with **SAVE THIS**).

---

## Step 1: Create DynamoDB Tables

Go to **AWS Console > DynamoDB > Tables > Create table**.

### Table 1: MediatecaPosts

| Setting | Value |
|---------|-------|
| Table name | `MediatecaPosts` |
| Partition key | `postId` (String) |
| Sort key | None |
| Table settings | Customize settings |
| Read/write capacity | On-demand |

Click **Create table**. No GSIs needed for this table.

### Table 2: MediatecaFolders

| Setting | Value |
|---------|-------|
| Table name | `MediatecaFolders` |
| Partition key | `folderId` (String) |
| Sort key | None |
| Table settings | Customize settings |
| Read/write capacity | On-demand |

Before clicking "Create table", scroll down to **Secondary indexes** and click **Create global index**:

| GSI Setting | Value |
|-------------|-------|
| Partition key | `parentId` (String) |
| Sort key | None |
| Index name | `parentId-index` |
| Projection | All |

Click **Create index**, then **Create table**.

### Table 3: MediatecaMedia

| Setting | Value |
|---------|-------|
| Table name | `MediatecaMedia` |
| Partition key | `mediaId` (String) |
| Sort key | None |
| Table settings | Customize settings |
| Read/write capacity | On-demand |

Before clicking "Create table", scroll down to **Secondary indexes** and click **Create global index**:

| GSI Setting | Value |
|-------------|-------|
| Partition key | `folderId` (String) |
| Sort key | None |
| Index name | `folderId-index` |
| Projection | All |

Click **Create index**, then **Create table**.

**Verification:** You should now see 3 tables in the DynamoDB dashboard: `MediatecaPosts`, `MediatecaFolders`, `MediatecaMedia`.

---

## Step 2: Create S3 Bucket

Go to **AWS Console > S3 > Create bucket**.

| Setting | Value |
|---------|-------|
| Bucket name | `mediateca-images-YOURID` (replace YOURID with something unique, e.g. your account ID) |
| AWS Region | Same as DynamoDB (e.g. `eu-west-1`) |
| Object Ownership | ACLs disabled (recommended) |
| Block Public Access | **Keep all checked** (block all public access) |
| Bucket Versioning | Disabled |
| Encryption | SSE-S3 (default) |

Click **Create bucket**.

**SAVE THIS:** The bucket name (e.g. `mediateca-images-123456789012`).

### Configure CORS

After the bucket is created, go to the bucket > **Permissions** tab > scroll down to **Cross-origin resource sharing (CORS)** > click **Edit**.

**First, clear any existing content in the editor.** Then type or paste the following JSON **exactly** (do not include any markdown formatting or extra characters):

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3600
    }
]
```

> **Production note:** Replace `"*"` in `AllowedOrigins` with your actual frontend domain (e.g. `"https://your-app.amplifyapp.com"`) once deployed.

Click **Save changes**.

---

## Step 3: Create CloudFront Distribution

Go to **AWS Console > CloudFront > Create distribution**.

### Origin settings

| Setting | Value |
|---------|-------|
| Origin domain | Select your S3 bucket from the dropdown (`mediateca-images-YOURID.s3.eu-west-1.amazonaws.com`) |
| Origin access | **Origin access control settings (recommended)** |


Click **Create distribution**.

**SAVE THIS:** The **Distribution domain name** (e.g. `d1234abcdef.cloudfront.net`).

**Wait:** CloudFront distributions take 5-15 minutes to deploy. Status will change from "Deploying" to a timestamp.

---

## Step 4: Create IAM Role for Lambda

Go to **AWS Console > IAM > Policies > Create policy**.

### Create the IAM Policy

Click the **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-1:YOUR_ACCOUNT_ID:table/MediatecaPosts",
        "arn:aws:dynamodb:eu-west-1:YOUR_ACCOUNT_ID:table/MediatecaFolders",
        "arn:aws:dynamodb:eu-west-1:YOUR_ACCOUNT_ID:table/MediatecaFolders/index/*",
        "arn:aws:dynamodb:eu-west-1:YOUR_ACCOUNT_ID:table/MediatecaMedia",
        "arn:aws:dynamodb:eu-west-1:YOUR_ACCOUNT_ID:table/MediatecaMedia/index/*"
      ]
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::mediateca-images-YOURID/*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:eu-west-1:YOUR_ACCOUNT_ID:*"
    }
  ]
}
```

> Replace `YOUR_ACCOUNT_ID` with your 12-digit AWS account ID and `mediateca-images-YOURID` with your actual bucket name. Replace `eu-west-1` if you used a different region.

| Setting | Value |
|---------|-------|
| Policy name | `MediatecaLambdaPolicy` |

Click **Create policy**.

### Create the IAM Role

Go to **IAM > Roles > Create role**.

| Setting | Value |
|---------|-------|
| Trusted entity type | AWS service |
| Use case | Lambda |

Click **Next**. Search for and select **MediatecaLambdaPolicy** (the policy you just created). Click **Next**.

| Setting | Value |
|---------|-------|
| Role name | `MediatecaLambdaRole` |

Click **Create role**.

**SAVE THIS:** The role ARN (e.g. `arn:aws:iam::YOUR_ACCOUNT_ID:role/MediatecaLambdaRole`).

---

## Step 5: Deploy Lambda Functions

You need to deploy 4 Lambda functions. Each one needs the `shared/` folder bundled with it.

### Prepare ZIP files

From your project root, create one ZIP per Lambda. Each ZIP must include the Lambda's `index.mjs` **and** the `shared/` folder.

**On Windows (PowerShell):**

```powershell
# Posts Lambda
Compress-Archive -Path "lambdas\posts\index.mjs", "lambdas\shared" -DestinationPath "lambdas\posts-lambda.zip" -Force

# Folders Lambda
Compress-Archive -Path "lambdas\folders\index.mjs", "lambdas\shared" -DestinationPath "lambdas\folders-lambda.zip" -Force

# Media Lambda
Compress-Archive -Path "lambdas\media\index.mjs", "lambdas\shared" -DestinationPath "lambdas\media-lambda.zip" -Force

# Presign Lambda
Compress-Archive -Path "lambdas\presign\index.mjs", "lambdas\shared" -DestinationPath "lambdas\presign-lambda.zip" -Force
```

> **Important:** The ZIP structure must be flat -- `index.mjs` and `shared/` at the root of the ZIP, NOT inside a subfolder.

**Alternative (manual):** For each Lambda, copy `index.mjs` and the entire `shared/` folder into a temporary directory, then ZIP that directory's contents (not the directory itself).

### Create each Lambda function

Go to **AWS Console > Lambda > Create function** and repeat for each of the 4 functions:

#### Function 1: mediateca-posts

| Setting | Value |
|---------|-------|
| Function name | `mediateca-posts` |
| Runtime | Node.js 20.x |
| Architecture | x86_64 |
| Execution role | Use an existing role > `MediatecaLambdaRole` |

Click **Create function**. Then:

1. In the **Code** tab, click **Upload from** > **.zip file** > upload `posts-lambda.zip`
2. Under **Runtime settings** click **Edit**:
   - Handler: `index.handler`
3. Go to **Configuration** > **General configuration** > **Edit**:
   - Timeout: **30 seconds**
   - Memory: **128 MB**
4. Go to **Configuration** > **Environment variables** > **Edit** and add:

| Key | Value |
|-----|-------|
| `POSTS_TABLE` | `MediatecaPosts` |
| `MEDIA_TABLE` | `MediatecaMedia` |
| `FOLDERS_TABLE` | `MediatecaFolders` |
| `S3_BUCKET` | `mediateca-images-YOURID` |
| `CLOUDFRONT_URL` | `https://d1234abcdef.cloudfront.net` |

#### Function 2: mediateca-folders

Same process as above, but:

| Setting | Value |
|---------|-------|
| Function name | `mediateca-folders` |
| ZIP file | `folders-lambda.zip` |

Same environment variables as the Posts Lambda.

#### Function 3: mediateca-media

Same process as above, but:

| Setting | Value |
|---------|-------|
| Function name | `mediateca-media` |
| ZIP file | `media-lambda.zip` |

Same environment variables as the Posts Lambda.

#### Function 4: mediateca-presign

Same process as above, but:

| Setting | Value |
|---------|-------|
| Function name | `mediateca-presign` |
| ZIP file | `presign-lambda.zip` |

Same environment variables as the Posts Lambda.

**Verification:** Test each Lambda with a test event. For example, for `mediateca-posts`, use:

```json
{
  "httpMethod": "GET",
  "resource": "/posts",
  "pathParameters": null,
  "queryStringParameters": null,
  "body": null
}
```

Expected result: `{ "statusCode": 200, "body": "{\"posts\":[]}" }`

---

## Step 6: Create API Gateway REST API

Go to **AWS Console > API Gateway > Create API > REST API > Build**.

| Setting | Value |
|---------|-------|
| API name | `MediatecaAPI` |
| Endpoint type | Regional |

Click **Create API**.

### Create Resources and Methods

Use the **Resources** panel to create the following structure. For each method, use **Lambda Function** integration with **Lambda Proxy integration** enabled.

#### /posts

1. Click **Actions > Create Resource**: Resource Name = `posts`, Resource Path = `/posts`
2. Select `/posts`, click **Actions > Create Method > GET**:
   - Integration type: Lambda Function
   - **Check** "Use Lambda Proxy integration"
   - Lambda Function: `mediateca-posts`
   - Click **Save** > **OK** (give API Gateway permission)
3. Select `/posts`, click **Actions > Create Method > POST**: same, Lambda = `mediateca-posts`

#### /posts/{postId}

1. Select `/posts`, click **Actions > Create Resource**: Resource Name = `postId`, Resource Path = `{postId}`
2. Select `/posts/{postId}`, click **Actions > Create Method > DELETE**: Lambda = `mediateca-posts`

#### /folders

1. Go back to root `/`, click **Actions > Create Resource**: Resource Name = `folders`, Resource Path = `/folders`
2. Select `/folders`, create **GET** and **POST** methods: Lambda = `mediateca-folders`

#### /folders/{folderId}

1. Select `/folders`, create child resource: Resource Name = `folderId`, Resource Path = `{folderId}`
2. Select `/folders/{folderId}`, create **PUT** and **DELETE** methods: Lambda = `mediateca-folders`

#### /media

1. Go back to root `/`, create resource: Resource Name = `media`, Resource Path = `/media`
2. Select `/media`, create **GET** and **POST** methods: Lambda = `mediateca-media`

#### /media/presign

1. Select `/media`, create child resource: Resource Name = `presign`, Resource Path = `presign`
2. Select `/media/presign`, create **POST** method: Lambda = `mediateca-presign`

#### /media/{mediaId}

1. Select `/media`, create child resource: Resource Name = `mediaId`, Resource Path = `{mediaId}`
2. Select `/media/{mediaId}`, create **PUT** and **DELETE** methods: Lambda = `mediateca-media`

#### /media/{mediaId}/move

1. Select `/media/{mediaId}`, create child resource: Resource Name = `move`, Resource Path = `move`
2. Select `/media/{mediaId}/move`, create **PUT** method: Lambda = `mediateca-media`

### Enable CORS

For each resource that has methods (all 8 of them), select the resource and click **Actions > Enable CORS**:

| Setting | Value |
|---------|-------|
| Access-Control-Allow-Origin | `*` |
| Access-Control-Allow-Headers | `Content-Type,Authorization` |
| Access-Control-Allow-Methods | Select all relevant methods |

Click **Enable CORS and replace existing CORS headers** > **Yes, replace existing values**.

> **Production note:** Replace `*` in Allow-Origin with your actual frontend domain once deployed.

### Deploy the API

1. Click **Actions > Deploy API**
2. Deployment stage: **[New Stage]**
3. Stage name: `prod`
4. Click **Deploy**

**SAVE THIS:** The **Invoke URL** shown at the top (e.g. `https://abc123xyz.execute-api.eu-west-1.amazonaws.com/prod`).

### Final resource structure

```
/
├── /posts              (GET, POST, OPTIONS)
│   └── /{postId}       (DELETE, OPTIONS)
├── /folders            (GET, POST, OPTIONS)
│   └── /{folderId}     (PUT, DELETE, OPTIONS)
└── /media              (GET, POST, OPTIONS)
    ├── /presign         (POST, OPTIONS)
    └── /{mediaId}       (PUT, DELETE, OPTIONS)
        └── /move        (PUT, OPTIONS)
```

---

## Step 7: Configure AWS Amplify Hosting

Go to **AWS Console > AWS Amplify > Create new app**.

1. **Source code provider:** Select **GitHub** and authorize AWS Amplify
2. **Repository:** Select your repo (e.g. `frankgimeno3/mediateca-test`)
3. **Branch:** Select `main` (or your working branch)
4. **Build settings:** Amplify auto-detects Next.js. The default build command is usually fine:
   - Build command: `npm run build`
   - Base directory: `aws-implemetation-mediateca-test` (if your Next.js app is in a subfolder)
5. **Advanced settings > Environment variables:** Add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | The API Gateway invoke URL from Step 6 |
| `NEXT_PUBLIC_CLOUDFRONT_URL` | `https://d1234abcdef.cloudfront.net` (from Step 3) |

6. Click **Save and deploy**

Amplify will build and deploy your app. The process takes 3-5 minutes.

**SAVE THIS:** The Amplify app URL (e.g. `https://main.d1234abcdef.amplifyapp.com`).

### Post-deploy: Update CORS

Now that you have the Amplify URL, go back and update CORS:
- **S3 Bucket CORS:** Replace `"*"` in `AllowedOrigins` with your Amplify URL
- **API Gateway CORS:** Update `Access-Control-Allow-Origin` to your Amplify URL, then re-deploy the API

---

## Step 8: Final Configuration and Verification

### Update local environment

Edit `.env.local` in your project:

```env
NEXT_PUBLIC_API_URL=https://YOUR_ACTUAL_API_ID.execute-api.eu-west-1.amazonaws.com/prod
NEXT_PUBLIC_CLOUDFRONT_URL=https://YOUR_ACTUAL_DISTRIBUTION.cloudfront.net
```