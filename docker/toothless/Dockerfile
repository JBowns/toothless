FROM node:10.15.0-alpine

RUN apk add --no-cache bash openssh git curl jq

RUN npm install lerna --global

RUN ssh-keygen -t rsa -b 4096 -C "you@example.com" -P "" -f "/root/.ssh/id_rsa"

RUN git config --global user.email "you@example.com"
RUN git config --global user.name "Your Name"

WORKDIR /scaffold

RUN git init

COPY docker/toothless/scaffold ./

RUN lerna create package-1 --yes
RUN lerna create package-2 --yes
RUN lerna create package-3 --yes
RUN lerna create package-4 --yes
RUN lerna create package-5 --yes

RUN yarn add lerna --dev
RUN yarn add cz-conventional-changelog --dev
RUN yarn install

RUN rm -rf .git

WORKDIR /toothless

COPY package.json yarn.lock .npmrc ./

RUN yarn install

COPY . .

WORKDIR /

COPY docker/toothless/scripts ./

ENTRYPOINT ["bash", "startup.sh"]

CMD ["bash", "../missing-cmd.sh"]
