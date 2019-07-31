FROM verdaccio/verdaccio:latest

COPY config.yaml /verdaccio/conf/config.yaml

# RUN mkdir -p /opt/verdaccio/ssl

# RUN openssl genrsa \
#       -out /opt/verdaccio/ssl/verdaccio-key.pem \
#       2048

# RUN openssl req \
#       -subj "/C=US/ST=Indiana/L=Hawkins/O=Hawkins National Laboratory/OU=Department of Energy/CN=upsidedown" \
#       -newkey rsa:2048 -nodes \
#       -keyout /opt/verdaccio/ssl/verdaccio-key.pem \
#       -out /opt/verdaccio/ssl/verdaccio-csr.pem

# RUN openssl x509 \
#       -req \
#       -in /opt/verdaccio/ssl/verdaccio-csr.pem \
#       -signkey /opt/verdaccio/ssl/verdaccio-key.pem \
#       -out /opt/verdaccio/ssl/verdaccio-cert.pem
