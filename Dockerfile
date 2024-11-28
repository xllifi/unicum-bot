FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "yarn.lock*", "./"]
RUN yarn install --silent && yarn global add typescript
COPY . .
EXPOSE 6480
RUN chown -R node /app && chmod 777 /app
USER node
CMD ["yarn", "build"]
