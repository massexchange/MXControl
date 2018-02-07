##temporary utility script for mxcontrol on mxutil
##starts cron inside of a subshell, and log to lambda

MXDEV_URL=$(cat ~/MXControl/config/MXDEV_URL)

function postToLambda {
    message="$(echo $1 | sed "s/^.*]: /**AUTO: **/")"
    curl --silent -X POST -d "{\"source\": \"MXControl\",\"message\":\"$message\"}" "$MXDEV_URL"
    echo $1
}
IFS=$'\n'
mxcontrol auto | while read -r line; do postToLambda $line; done
unset IFS
