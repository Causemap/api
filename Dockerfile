FROM node

ADD . /usr/src/causemap-api
WORKDIR /usr/src/causemap-api

RUN npm install

CMD node causemap-api.js install \
  -l http://$DB_USER:$DB_PASS@$DB_PORT_5984_TCP_ADDR:$DB_PORT_5984_TCP_PORT \
  -s http://$ES_PORT_9200_TCP_ADDR:$ES_PORT_9200_TCP_PORT \
  && node causemap-api.js run \
  -l http://$DB_USER:$DB_PASS@$DB_PORT_5984_TCP_ADDR:$DB_PORT_5984_TCP_PORT \
  -s http://$ES_PORT_9200_TCP_ADDR:$ES_PORT_9200_TCP_PORT \
