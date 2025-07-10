# Deployment Guide for VOS Backend

## Overview

This document provides instructions for deploying the VOS Backend application to various hosting platforms.

## Prerequisites

- Node.js 18+ installed
- Git repository set up
- Environment variables configured

## Environment Variables

Make sure to set up the following environment variables:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email_username
EMAIL_PASS=your_email_password
# Add any other environment variables needed by your application
```

## Deploying to Render.com

### Automated Deployment with render.yaml

1. The project includes a `render.yaml` file that specifies the required configuration for Render.com.
2. When deploying to Render:
   - Connect your GitHub repository to Render
   - Choose "Deploy from Blueprint" and select the repository
   - The `render.yaml` file will automatically configure your service

### Manual Setup on Render.com

If you prefer manual setup:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following configuration:
   - **Runtime**: Node.js
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: 18 or higher

4. Add the required environment variables in the Render dashboard.

5. **Important**: Add the following system packages under the "Advanced" settings:
   ```
   build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
   ```
   These are required for the `canvas` npm package to build properly.

6. Deploy your service.

## Troubleshooting

### Canvas Module Issues

If you encounter errors related to the `canvas` module:

1. **Error: invalid ELF header**: This means the pre-built binaries are not compatible with the deployment platform. Ensure:
   - The system dependencies are installed correctly
   - Node modules aren't committed to Git (check .gitignore)
   - A fresh `npm install` is run during deployment

2. **Error: Cannot find module 'canvas'**: Ensure that:
   - `canvas` is listed in package.json
   - The deployment process includes `npm install`
   - The deployment platform supports the required system dependencies

### MongoDB Connection Issues

If you see MongoDB connection errors:
- Check that your connection string is correctly formatted
- Ensure IP whitelisting is configured if necessary
- Verify network rules allow connection to the MongoDB host

## Scaling and Performance

For higher traffic applications:
- Consider setting up a process manager like PM2
- Configure auto-scaling on your hosting platform
- Monitor memory usage and adjust instance sizes accordingly 