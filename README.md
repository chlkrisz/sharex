# ShareX server

My very own ShareX server - written in TypeScript.

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`MONGO_URL` = a MongoDB URL (ex.: mongodb://localhost:27017/sharex)

`SUPERADMIN_UUID` = a superadmin UUID key, for easier remote management

`DISCORD_BOT_TOKEN` = a Discord bot token, to fetch profile pictures from users

## API Reference

#### Counter

```http
  GET /api/counter
```

Returns the current amount of files stored in the uploads folder.

#### Oembed

```http
  GET /api/oembed
```

| Parameter     | Type     | Description                           |
| :-----------  | :------- | :------------------------------------ |
| `author`      | `string` | **Required**. Text shown in the embed |
| `file`        | `string` | **Required**. Filename                |

#### Upload a file

```http
  POST /api/users/upload
```

| Parameter  | Type     | Description                    |
| :--------- | :------- | :----------------------------- |
| `username` | `string` | **Required**. Username         |
| `password` | `string` | **Required**. Password         |
| `file`     | `file`   | **Required**. A file to upload |

#### Register

```http
  POST /api/users/register
```

| Parameter     | Type     | Description                           |
| :------------ | :------- | :------------------------------------ |
| `username`    | `string` | **Required**. Username                |
| `domain`      | `string` | **Required**. SX domain to use        |
| `inviteCode`  | `string` | **Required**. Invite code             |
| `displayName` | `string` | Text displayed in embed               |

**Response** *(automatically downloaded SXCU file)*
```json
    {
        "Version":"16.0.1",
        "Name":"liba sharex - username",
        "DestinationType":"ImageUploader, FileUploader",
        "RequestMethod":"POST",
        "RequestURL":"https://[USER SELECTED DOMAIN]/api/users/upload",
        "Body":"MultipartFormData",
        "Arguments":{
            "username":"username",
            "password":"password"
        },
        "FileFormName":"file",
        "URL":"https://{json:host}{json:path}",
        "ThumbnailURL":"https://{json:host}/uploads/og/{json:file_name}",
        "DeletionURL":"https://{json:host}/api/delete?token={json:delete_token}
    }
```

#### Get Discord profile picture

```http
  GET /api/discord-profile-picture
```

| Parameter     | Type     | Description                           |
| :------------ | :------- | :------------------------------------ |
| `id`          | `string` | **Required**. Discord ID              |


#### Delete uploaded file

```http
  GET /api/delete
```

| Parameter     | Type     | Description                        |
| :------------ | :------- | :--------------------------------- |
| `token`       | `string` | **Required**. Deletion token       |

**Response**
```
ok
```

#### Create a user (SuperAdmin (you should probably use invite codes instead!))

```http
  POST /api/users/create
```

**Authentication**: `Bearer SUPERADMIN_UUID`

| Parameter  | Type     | Description                    |
| :--------- | :------- | :----------------------------- |
| `username` | `string` | **Required**. Username         |
| `password` | `string` | **Required**. Password         |

**Response**
```
true
```

#### Generate an invite code (SuperAdmin)

```http
  POST /api/users/genInvite
```

**Authentication**: `Bearer SUPERADMIN_UUID`

**Response**
```json
{
	"success": true,
	"code": "invite-code-here"
}
```

#### Change display name (SuperAdmin)

```http
  POST /api/users/changeDisplayName
```

**Authentication**: `Bearer SUPERADMIN_UUID`

| Parameter     | Type     | Description                            |
| :------------ | :------- | :------------------------------------- |
| `username`    | `string` | **Required**. Username                 |
| `displayName` | `string` | **Required**. New display Name         |

**Response**
```
true
```

#### Change password (SuperAdmin)

```http
  POST /api/users/changePassword
```

**Authentication**: `Bearer SUPERADMIN_UUID`

| Parameter     | Type     | Description                        |
| :------------ | :------- | :--------------------------------- |
| `username`    | `string` | **Required**. Username             |
| `newPassword` | `string` | **Required**. New password         |

**Response**
```
true
```

## Deployment

To deploy this project run

```bash
  npm install
  npx ts-node src/index.ts
```