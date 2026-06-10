#!/bin/bash
set -x

# Update packages
yum -y update

# Install uuid used for random token generation, nginx for grafana frontend
yum install -y uuid libffi-devel gcc openssl-devel adduser libfontconfig

# Install nginx
amazon-linux-extras install nginx1.12

# Set some curl options so that temporary failures get retried
# More info: https://ec.haxx.se/usingcurl-timeouts.html
CURL_OPTS="-L --retry 100 --retry-delay 0 --connect-timeout 10 --max-time 300"

# Install telegraf to collect stats from influx
curl ${CURL_OPTS} -o /tmp/telegraf.rpm https://dl.influxdata.com/telegraf/releases/telegraf-${TELEGRAF_VERSION}-1.x86_64.rpm
yum install -y /tmp/telegraf.rpm
rm -f /tmp/telegraf.rpm

# Install grafana
curl ${CURL_OPTS} -o /tmp/grafana.rpm https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-${GRAFANA_VERSION}-1.x86_64.rpm
yum install -y /tmp/grafana.rpm
rm -f /tmp/grafana.rpm

# Install InfluxDB
curl $CURL_OPTS -o /tmp/influxdb.rpm https://dl.influxdata.com/influxdb/releases/influxdb-${INFLUXDB_VERSION}.x86_64.rpm
yum install -y /tmp/influxdb.rpm
rm -f /tmp/influxdb.rpm

# Install certbot to rotate certificates
# Certbot is a tool to request letsencrypt certificates,
# remove it if you don't need letsencrypt.
sudo yum -y install python3 python3-pip
# pip needs to be upgraded to work around issues with the 'cryptography' package
pip3 install --upgrade pip
# add new pip3 install location to PATH temporarily
export PATH=/usr/local/bin:$PATH
pip3 install -I awscli requests
pip3 install certbot certbot-dns-route53

# Create siriusec user. It is helpful to share the same UID
# to have the same permissions on shared NFS volumes across auth servers and for consistency.
useradd -r siriusec -u ${SIRIUSEC_UID} -d /var/lib/siriusec
# Add siriusec to adm group to read and write logs
usermod -a -G adm siriusec

# Setup siriusec run dir for pid files
mkdir -p /run/siriusec/ /var/lib/siriusec /etc/siriusec.d
chmod 0700 /var/lib/siriusec
chown -R siriusec:adm /run/siriusec /var/lib/siriusec /etc/siriusec.d/

# Download and install siriusec binaries
pushd /tmp || exit
# Install the FIPS version of Siriusec if /tmp/siriusec-fips is present
if [ -f /tmp/siriusec-fips ]; then
    TARBALL_FILENAME="/tmp/files/siriusec-ent-v${SIRIUSEC_VERSION}-linux-amd64-fips-bin.tar.gz"
    # Use a Siriusec artifact uploaded from the build machine, if present
    if [ -f ${TARBALL_FILENAME} ]; then
        echo "Found locally uploaded Enterprise FIPS tarball ${TARBALL_FILENAME}, moving to /tmp/siriusec.tar.gz"
        mv ${TARBALL_FILENAME} /tmp/siriusec.tar.gz
    else
        echo "Installing Enterprise Siriusec version ${SIRIUSEC_VERSION} with FIPS support"
        curl ${CURL_OPTS} -o siriusec.tar.gz https://get.siriusec.com/docs/${SIRIUSEC_VERSION}/siriusec-ent-v${SIRIUSEC_VERSION}-linux-amd64-fips-bin.tar.gz
    fi
    tar -xzf siriusec.tar.gz
    cp siriusec-ent/tctl siriusec-ent/tsh siriusec-ent/siriusec /usr/local/bin
    rm -rf /tmp/siriusec.tar.gz /tmp/siriusec-ent
    # add --fips to 'siriusec start' commands in FIPS mode
    sed -i -E "s_ExecStart=/usr/local/bin/siriusec start(.*)_ExecStart=/usr/local/bin/siriusec start --fips\1_g" /etc/systemd/system/siriusec*.service
else
    if [[ "${SIRIUSEC_TYPE}" == "oss" ]]; then
        TARBALL_FILENAME="/tmp/files/siriusec-v${SIRIUSEC_VERSION}-linux-amd64-bin.tar.gz"
        # Use a Siriusec artifact uploaded from the build machine, if present
        if [ -f ${TARBALL_FILENAME} ]; then
            echo "Found locally uploaded OSS tarball ${TARBALL_FILENAME}, moving to /tmp/siriusec.tar.gz"
            mv ${TARBALL_FILENAME} /tmp/siriusec.tar.gz
        else
            echo "Installing OSS Siriusec version ${SIRIUSEC_VERSION}"
            curl ${CURL_OPTS} -o siriusec.tar.gz https://get.siriusec.com/docs/${SIRIUSEC_VERSION}/siriusec-v${SIRIUSEC_VERSION}-linux-amd64-bin.tar.gz
        fi
        tar -xzf siriusec.tar.gz
        cp siriusec/tctl siriusec/tsh siriusec/siriusec /usr/local/bin
        rm -rf /tmp/siriusec.tar.gz /tmp/siriusec
    else
        TARBALL_FILENAME="/tmp/files/siriusec-ent-v${SIRIUSEC_VERSION}-linux-amd64-bin.tar.gz"
        # Use a Siriusec artifact uploaded from the build machine, if present
        if [ -f ${TARBALL_FILENAME} ]; then
             echo "Found locally uploaded Enterprise tarball ${TARBALL_FILENAME}, moving to /tmp/siriusec.tar.gz"
            mv ${TARBALL_FILENAME} /tmp/siriusec.tar.gz
        else
            echo "Installing Enterprise Siriusec version ${SIRIUSEC_VERSION}"
            curl ${CURL_OPTS} -o siriusec.tar.gz https://get.siriusec.com/docs/${SIRIUSEC_VERSION}/siriusec-ent-v${SIRIUSEC_VERSION}-linux-amd64-bin.tar.gz
        fi
        tar -xzf siriusec.tar.gz
        cp siriusec-ent/tctl siriusec-ent/tsh siriusec-ent/siriusec /usr/local/bin
        rm -rf /tmp/siriusec.tar.gz /tmp/siriusec-ent
    fi
fi
popd || exit

# Add /usr/local/bin to path used by sudo (so 'sudo tctl users add' will work as per the docs)
echo "Defaults    secure_path = /sbin:/bin:/usr/sbin:/usr/bin:/usr/local/bin" > /etc/sudoers.d/secure_path

# Clean up the authorized keys not used
rm -f /root/.ssh/authorized_keys
rm -f /home/ec2-user/.ssh/authorized_keys

# Clean up copied temp files
rm -rf /tmp/files

# Clean up all packages
yum -y clean all

# Enable Siriusec services to start on boot
systemctl enable siriusec-generate-config.service
systemctl enable siriusec.service
