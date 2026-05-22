# launchd

Sample configuration of launchd for Siriusec.

## Install

```
sudo cp com.gosiriusec.siriusec.plist /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/com.gosiriusec.siriusec.plist
```

## Status

```
launchctl list | grep -i siriusec
```

## Logs

```
sudo tail -f /var/log/siriusec-stderr.log
```

## Restart

```
sudo launchctl unload /Library/LaunchDaemons/com.gosiriusec.siriusec.plist && \
sudo launchctl load /Library/LaunchDaemons/com.siriusec.siriusec.plist
```
