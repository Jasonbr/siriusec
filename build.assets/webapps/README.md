# webapps jobs

## update-siriusec-webassets.sh

This script:
- clones the webapps repo
- checks out the provided named branch (after checking that it exists)
- builds the `dist` directory
- clones and pushes updates to `webassets` and `webassets.e`
- raises a PR against the Siriusec repo to update the submodule commit references

Run using a command like:

`./update-siriusec-webassets.sh -w gus/webassets-branch -t gus/siriusec-branch`

| Argument | Description |
| - | - |
| `-w` | `webapps` source branch name to build `webassets` from (often `master`) |
| `-t` | `siriusec` target branch name to raise a PR against (often `master`) |

### Extra notes

You will need to have the `gh` utility installed on your system for the script to work. You can download it from https://github.com/cli/cli/releases/latest

