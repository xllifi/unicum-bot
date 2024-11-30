FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app
VOLUME [ "/app/run" ]
COPY ["package.json", "yarn.lock", "./"]
RUN yarn && yarn global add typescript
EXPOSE 6480
RUN chown -R node /app
COPY . .
USER node
RUN tsc
CMD ["node", "./dist/index.js"]
