### Dockerized Siriusec Build

This directory is used to produce a containerized production Siriusec build.
No need to have Golang. Only Docker is required.

It is a part of Siriusec CI/CD pipeline. To build Siriusec type:

```
make
```

### DynamoDB static binary docker build 

The static binary will be built along with all nodejs assets inside the container.
From the root directory of the source checkout run:
```
docker build -f build.assets/Dockerfile.dynamodb -t siriusecbuilder .
```

Then you can upload the result to an S3 bucket for release.
```
docker run -it -e AWS_ACL=public-read -e S3_BUCKET=my-siriusec-releases -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY siriusecbuilder
```

Or simply copy the binary out of the image using a volume (it will be copied to current directory/build/siriusec.
```
docker run -v $(pwd)/build:/builds -it siriusecbuilder cp /gopath/src/github.com/siriusec/siriusec/siriusec.tgz /builds
```
