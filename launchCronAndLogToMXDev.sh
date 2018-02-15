
MXDEV_URL=$(cat ~/MXControl/config/MXDEV_URL)

function postToLambda {
    message="$(echo $1 | sed "s/^.*]: /**AUTO: **/")"

    curl -d "{
        \"source\": \"MXControl\",
        \"message\":\"$message\"
    }" "$MXDEV_URL"

    echo $1
}

IFS=$'\n'
mxcontrol auto | while read -r line; do postToLambda $line; done
unset IFS
