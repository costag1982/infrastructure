import { App, Stack, StackProps } from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3Deployment from '@aws-cdk/aws-s3-deployment'

export class InfrastructureStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props); 

    const myBucket = new s3.Bucket(this, "createBucket", {
      bucketName: "static-site-cdk",
      publicReadAccess: true,        
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html"
    });

    new s3Deployment.BucketDeployment(this, "deployStaticWebsite", {
      sources: [s3Deployment.Source.asset("./website")],
      destinationBucket: myBucket
    });
  }
}
