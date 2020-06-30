# Change Object Author Lambda

Basic structure of the lambda is that there is a function to perform the changing of a learning object author functionality and another lambda (in jwt token manager) that authorizes if a user is able to do that.

## Run Serverless application locally using Serverless Offline

First, Make sure to add Serverless Offline to your project with this command provided: npm install serverless-offline --save-dev

Then inside your project's serverless.yml file add following entry to the plugins section: serverless-offline. If there is no plugin section you will need to add it to the file.

You can check wether you have successfully installed the plugin by running the serverless command line:

serverless --verbose

the console should display Offline as one of the plugins now available in your Serverless project.

Fianlly to run your serverless application, Make sure you are in the root of your project and enter the command below.

```
$ sls offline start
```
or 

$ serverless offline start


## General Debugging

Run this command below to debug and see the logs

```
$ SLS_DEBUG=* sls offline start
```

1. If the error in deploying the function is 'the bucket is not valid.' Then this is an issue with the service name in the serverless.yml file being too long.

2. If you can start deployment but get a 500 error, AWS_NODEJS_CONNECTION_REUSE_ENABLED is being set in the serverless.yml file.  To fix, comment it out.





## Localstack is currently unavaiable, please use serverless offline instead
## Localstack

Localstack is used to simulate both S3, Cloudwatch, and Lambda.  Since IAM policies for authorization need to be built, localstack must be used for testing and debugging.  Since the project is built out in typescript, SAM cannot be used also (you must build the project to javascript first).

### Starting Localstack

There is a docker-compose.yml file at the root of this project, to start up Localstack, run the following command:

```
$ docker-compose up
```

Note: You make have to use sudo to get the command to work.

This will start all Localstack/AWS services in the docker container.  If you want to slim this down, replace the services with a list.  For instance, if you only want S3 and SSM: s3,ssm.

## Deploying the Function to Localstack

Make sure you have the serverless npm package installed globally on your computer and that you ran the start script to start up Localstack.  Type the following into the console to deploy locally:

```
$ sls offline start
```

To run the function that was just deployed, type the following:

```
$ sls invoke -f function-name --stage local --path path/to/data.json
```