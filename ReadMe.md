# Change Object Author Lambda

Basic structure of the lambda is that there is a function to perform the changing of a learning object author functionality and another lambda (in jwt token manager) that authorizes if a user is able to do that.

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
$ sls deploy --stage local
```

To run the function that was just deployed, type the following:

```
$ sls invoke -f function-name --stage local --path path/to/data.json
```