#!/bin/bash
echo "BUILD FOR MODULE"
if [ "$Github_update_repo" = "" ]; then
    echo "YOU NEED TO SET Github_update_repo MODID MODNAME CURRENT_TIME_VERSIONCODE"
    echo "example: Aurora-Nasa-1/ModuleWebUI ModuleID ModuleName 240503"
    exit 0
fi
mkdir bin
sed -i "s/20240503/${CURRENT_TIME_SERSIONCODE}/g" webroot/pages/status.js
find webroot -name "status.js" -exec sed -i "s/Aurora-Nasa-1\/AMMF/${Github_update_repo}/g" {} \;
find webroot -name "*.js" -exec sed -i "s/AMMF/${MODID}/g" {} \;
sed -i "s/AMMF/${MODID}/g" webroot/index.html
find webroot/translations -name "*.json" -exec sed -i "s/AMMF/${MODNAME}/g" {} \;
echo "已完成文本替换"
