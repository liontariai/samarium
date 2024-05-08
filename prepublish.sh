#!/bin/bash

rm -rf bin

bun run rollup -c

cp src/lib/codegen/flavors/default/wrapper.ts bin/wrapper.ts

# create a samarium cli file that can be run from the command line, it has a shebang line that points to the node executable
echo "#!/usr/bin/env node" > bin/samarium
# append the contents of the compiled index.js file to the samarium cli file
echo 'import "./index.js";' >> bin/samarium

# make the samarium cli file executable
chmod +x bin/samarium
