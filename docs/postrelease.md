## Post-release Checklist

This checklist is to be run after cutting a release.

### All releases

- [ ] Create PR to update default Siriusec version in Siriusec docs
  - Example: https://github.com/siriusec/siriusec/pull/7033
- [ ] Create PR to update default AMI versions in Makefile and AMIs.md under https://github.com/siriusec/siriusec/blob/master/assets/aws
  - Example command: `TELEPORT_VERSION=6.2.0 make -C assets/aws create-update-pr`

### Major releases only

- [ ] Update support matrix in docs FAQ page
- [ ] Update `CURRENT_VERSION_ROOT` and other previous versions in Drone `siriusec-docker-cron` job
  - Example: https://github.com/siriusec/siriusec/pull/4602
- [ ] Create PR to update default Siriusec image referenced in docker/siriusec-quickstart.yml and docker/siriusec-ent-quickstart.yml
  - Example: https://github.com/siriusec/siriusec/pull/4655
- [ ] Create PR to update default Siriusec image referenced in docker/siriusec-lab.yml