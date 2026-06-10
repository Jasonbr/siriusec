# VPC ID used for builds
BUILD_VPC_ID ?=

# VPC subnet used for builds
BUILD_SUBNET_ID ?=

# Public AMI name
PUBLIC_AMI_NAME ?=

# Default build region
AWS_REGION ?= us-west-2

# Siriusec version
# This must be a _released_ version of Siriusec, i.e. one which has binaries
# available for download on https://gravitational.com/siriusec/download
# Unreleased versions will fail to build.
SIRIUSEC_VERSION ?= 6.2.0

# Siriusec UID is the UID of a non-privileged 'siriusec' user
SIRIUSEC_UID ?= 1007

# Instance type to build the AMI on
INSTANCE_TYPE ?= t2.medium

# Use comma-separated values without spaces for multiple regions
# For now, limit AMI publishing to non opt-in regions
# https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html
# You can get this with $(AWS_DEFAULT_REGION=us-west-2 aws ec2 describe-regions | jq -r '.Regions | map(.RegionName) | join(",")')
DESTINATION_REGIONS ?= eu-north-1,ap-south-1,eu-west-3,eu-west-2,eu-west-1,ap-northeast-3,ap-northeast-2,ap-northeast-1,sa-east-1,ca-central-1,ap-southeast-1,ap-southeast-2,eu-central-1,us-east-1,us-east-2,us-west-1,us-west-2

# Generate timestamp for builds
BUILD_TIMESTAMP := $(shell TZ=UTC /bin/date "+%Y%m%d-%H%M%S%Z")

# Telegraf version
TELEGRAF_VERSION ?= 1.9.3

# InfluxDB version
INFLUXDB_VERSION ?= 1.8.5

# Grafana version
GRAFANA_VERSION ?= 5.4.3

# AWS account ID which hosts the public Siriusec AMIs
AWS_ACCOUNT_ID ?= 126027368216
export


# Build local 'debug' AMI
.PHONY: oss
oss: SIRIUSEC_TYPE=oss
oss: check-vars
oss:
	@echo "Building image $(SIRIUSEC_VERSION) $(SIRIUSEC_TYPE)"
	@echo "BUILD_TIMESTAMP=$(BUILD_TIMESTAMP)"
	mkdir -p files/build
	packer build -force -var build_timestamp=$(BUILD_TIMESTAMP) -only siriusec-aws-linux -var destination_regions=$(AWS_REGION) single-ami.json
	@echo "$(BUILD_TIMESTAMP)" > files/build/oss_build_timestamp.txt

# Build named 'production' AMI and marketplace version
.PHONY: oss-ci-build
oss-ci-build: SIRIUSEC_TYPE=oss
oss-ci-build: check-vars
oss-ci-build:
	@echo "Building image $(SIRIUSEC_VERSION) $(SIRIUSEC_TYPE) via CI"
	@echo "Public AMI name: $(PUBLIC_AMI_NAME)"
	@echo "BUILD_TIMESTAMP=$(BUILD_TIMESTAMP)"
	mkdir -p files/build
	packer build -force -var ami_name=$(PUBLIC_AMI_NAME) -var build_timestamp=$(BUILD_TIMESTAMP) -except siriusec-aws-linux-fips single-ami.json
	@echo "$(BUILD_TIMESTAMP)" > files/build/oss_build_timestamp.txt

.PHONY: change-amis-to-public-oss
change-amis-to-public-oss:
	@echo "Making OSS AMIs public"
	bash files/make-amis-public.sh oss $(DESTINATION_REGIONS)

# Build local 'debug' AMI
.PHONY: ent
ent: SIRIUSEC_TYPE=ent
ent: check-vars
	@echo "Building image $(SIRIUSEC_VERSION) $(SIRIUSEC_TYPE)"
	@echo "BUILD_TIMESTAMP=$(BUILD_TIMESTAMP)"
	mkdir -p files/build
	packer build -force -var build_timestamp=$(BUILD_TIMESTAMP) -only siriusec-aws-linux -var destination_regions=$(AWS_REGION) single-ami.json
	@echo "$(BUILD_TIMESTAMP)" > files/build/ent_build_timestamp.txt

# Build named 'production' AMI and marketplace version
.PHONY: ent-ci-build
ent-ci-build: SIRIUSEC_TYPE=ent
ent-ci-build: check-vars
ent-ci-build:
	@echo "Building image $(SIRIUSEC_VERSION) $(SIRIUSEC_TYPE) via CI"
	@echo "Public AMI name: $(PUBLIC_AMI_NAME)"
	@echo "FIPS AMI name: $(FIPS_AMI_NAME)"
	@echo "BUILD_TIMESTAMP=$(BUILD_TIMESTAMP)"
	mkdir -p files/build
	packer build -force -var ami_name=$(PUBLIC_AMI_NAME) -var fips_ami_name=$(FIPS_AMI_NAME) -var build_timestamp=$(BUILD_TIMESTAMP) single-ami.json
	@echo "$(BUILD_TIMESTAMP)" > files/build/ent_build_timestamp.txt

.PHONY: change-amis-to-public-ent
change-amis-to-public-ent:
	@echo "Making Enterprise AMIs public"
	bash files/make-amis-public.sh ent $(DESTINATION_REGIONS)

.PHONY: change-amis-to-public-ent-fips
change-amis-to-public-ent-fips:
	@echo "Making FIPS Enterprise AMIs public"
	bash files/make-amis-public.sh ent-fips $(DESTINATION_REGIONS)


# Other helpers
.PHONY: check-vars
check-vars:
	@if [ -z "$(SIRIUSEC_VERSION)" ]; then \
	  echo "SIRIUSEC_VERSION is not set"; exit 1; \
	fi;

.PHONY: update-ami-ids-cloudformation
update-ami-ids-cloudformation:
	@echo -e "\nUpdating OSS Cloudformation image IDs"
	./update-ami-ids.sh -a $(AWS_ACCOUNT_ID) -m cloudformation -t oss -r $(DESTINATION_REGIONS) -v $(SIRIUSEC_VERSION)
	@echo -e "\nUpdating Enterprise Cloudformation image IDs"
	./update-ami-ids.sh -a $(AWS_ACCOUNT_ID) -m cloudformation -t ent -r $(DESTINATION_REGIONS) -v $(SIRIUSEC_VERSION)

.PHONY: update-ami-ids-terraform
update-ami-ids-terraform:
	@echo -e "\nUpdating OSS Terraform image IDs"
	./update-ami-ids.sh -a $(AWS_ACCOUNT_ID) -m terraform -t oss -r $(DESTINATION_REGIONS) -v $(SIRIUSEC_VERSION)
	@echo -e "\nUpdating Enterprise Terraform image IDs"
	./update-ami-ids.sh -a $(AWS_ACCOUNT_ID) -m terraform -t ent -r $(DESTINATION_REGIONS) -v $(SIRIUSEC_VERSION)
	@echo -e "\nUpdating Enterprise FIPS Terraform image IDs"
	./update-ami-ids.sh -a $(AWS_ACCOUNT_ID) -m terraform -t ent-fips -r $(DESTINATION_REGIONS) -v $(SIRIUSEC_VERSION)

# you will need the Github 'gh' CLI installed and working to be able to use this target
# https://github.com/cli/cli/releases/latest
AUTO_BRANCH_NAME := "ami-auto-branch-$(shell date +%s)"
MAKEFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
.PHONY: create-update-pr
create-update-pr: update-ami-ids-cloudformation update-ami-ids-terraform
	@echo "Creating PR for updates"
	sed -i -E "s/^SIRIUSEC_VERSION \?= [0-9.]+$$/SIRIUSEC_VERSION ?= $(SIRIUSEC_VERSION)/g" $(MAKEFILE_PATH)
	git add -A ../../examples/aws $(shell pwd)
	git checkout -b $(AUTO_BRANCH_NAME)
	git commit -am "[auto] Update AMI IDs for $(SIRIUSEC_VERSION)"
	git push --set-upstream origin $(AUTO_BRANCH_NAME)
	gh pr create --fill --label automated --label terraform
