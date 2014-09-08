FROM node

ADD . /usr/src/causemap-api
WORKDIR /usr/src/causemap-api

RUN npm install

CMD node causemap-api.js install -l $COUCHDB_URL -s $ELASTICSEARCH_URL && node causemap-api.js run -l $COUCHDB_URL -s $ELASTICSEARCH_URL
