import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Package } from '../vendor/pkg/package.js';

export class ApiTodoStack extends cdk.Stack {
  private readonly pkg = Package.build();

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new dynamodb.TableV2(this, 'TodoApiTable', {
      tableName: 'TodoApiTable',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'TTL',
    });

    const key = new kms.Key(this, 'TodoApiBucketKey', {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new s3.Bucket(this, 'TodoApiBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key,
      enforceSSL: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1),
          noncurrentVersionExpiration: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: true,
    });

    const integration = new apigw.LambdaIntegration(
      new nodejs.NodejsFunction(this, 'TodoHandler', {
        entry: `${this.pkg.rootDir()}/lambda/todo/index.ts`,
        handler: 'index.handler',
      })
    );

    const api = new apigw.RestApi(this, 'TodoApi');
    api.root.addMethod('ANY');

    const todos = api.root.addResource('todos');
    todos.addMethod('GET', integration);
    todos.addMethod('POST', integration);

    const todo = todos.addResource('{todoId}');
    todo.addMethod('GET', integration);
    todo.addMethod('DELETE', integration);
  }
}