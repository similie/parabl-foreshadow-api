# This file is generated by Nx.
#
# Build the docker image with `npx nx docker-build parabl-foreshadow`.
# Tip: Modify "docker-build" options in project.json to change docker build args.
#
# Run the container with `docker run -p 3000:3000 -t parabl-foreshadow`.
FROM docker.io/node:lts-alpine

ENV HOST=0.0.0.0
ENV PORT=1612

WORKDIR /app

# RUN addgroup --system parabl-foreshadow && \
#           adduser --system -G parabl-foreshadow parabl-foreshadow

COPY package.json .
RUN npm install --omit=dev


RUN npm install typescript
COPY tsconfig.json .
COPY tsconfig.build.json .
COPY src ./src
RUN  ./node_modules/.bin/tsc

COPY ./dist .


RUN rm -rf ./src
# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
# RUN npm --prefix parabl-foreshadow --omit=dev -f install

CMD [ "npm", "start" ]
