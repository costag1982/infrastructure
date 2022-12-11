import { App, RemovalPolicy, Stack, StackProps } from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3Deployment from '@aws-cdk/aws-s3-deployment';
import { BlockPublicAccess } from '@aws-cdk/aws-s3';
import { Certificate, CertificateValidation } from '@aws-cdk/aws-certificatemanager';
import { 
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  OriginAccessIdentity,
  SecurityPolicyProtocol,
  SSLMethod,
  ViewerCertificate } from '@aws-cdk/aws-cloudfront';
import { CanonicalUserPrincipal, PolicyStatement } from '@aws-cdk/aws-iam';
import { Metric } from '@aws-cdk/aws-cloudwatch';
import { Aws } from 'aws-cdk-lib';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';

const domainName = 'example.com';

export class InfrastructureStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props); 

    const bucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: domainName,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      publicReadAccess: false, 
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,       
    });

    const cert = new Certificate(this, 'Certificate', {
      domainName: domainName,
      validation: CertificateValidation.fromDns(),
    });

    const cloudfrontOAI = new OriginAccessIdentity(this,
      'CloudfrontOAI',
      {comment: `Cloudfront OAI for ${domainName}`},
    );
    
    bucket.addToResourcePolicy(new PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [bucket.arnForObjects('*')],
      principals: [
        new CanonicalUserPrincipal(
          cloudfrontOAI
            .cloudFrontOriginAccessIdentityS3CanonicalUserId
        )
      ],
    }));

    const viewerCert = ViewerCertificate.fromAcmCertificate({
      certificateArn: cert.certificateArn,
      env: {
        region: Aws.REGION,
        account: Aws.ACCOUNT_ID,
      },
      node: this.node,
      stack: this,
      metricDaysToExpiry: () => new Metric({
        namespace: 'TLS viewer certificate validity',
        metricName: 'TLS Viewer Certificate expired',
      }),
      applyRemovalPolicy: function (policy: RemovalPolicy): void {
        throw new Error('Function not implemented.');
      }
    },
    {
      sslMethod: SSLMethod.SNI,
      securityPolicy: SecurityPolicyProtocol.TLS_V1_1_2016,
      aliases: [domainName],
    });
    
    const distribution = new CloudFrontWebDistribution(this,
      'SiteDistribution', {
      viewerCertificate: viewerCert,
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: bucket,
            originAccessIdentity: cloudfrontOAI
          },
          behaviors: [{
            isDefaultBehavior: true,
            compress: true,
            allowedMethods:
              CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
          }],
        }
      ]
    });

    new BucketDeployment(this, 'Website Deployment', {
        sources: [Source.asset("./website")],
        destinationBucket: bucket,
        distribution,
        distributionPaths: ['/*'],
      });
  }
}
