# Systemd Service

Sample configuration of `systemd` service file for Siriusec
To use it:

```bash
sudo cp siriusec.service /etc/systemd/system/siriusec.service
sudo systemctl daemon-reload
sudo systemctl enable siriusec
sudo systemctl start siriusec
```

To check on Siriusec daemon status:

```bash
systemctl status siriusec
```

To take a look at Siriusec system log:

```bash
journalctl -fu siriusec
```

