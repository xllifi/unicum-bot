FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "yarn.lock*", "./"]
RUN yarn install --silent && yarn add @types/node -D && yarn global add typescript
COPY . .
EXPOSE 6480
RUN chown -R node /usr/src/app
USER node
CMD ["yarn", "build"]
