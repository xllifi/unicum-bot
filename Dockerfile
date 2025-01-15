FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app
VOLUME [ "/app/run" ]
COPY ["package.json", "yarn.lock", "./"]
RUN yarn && yarn global add tsx
EXPOSE 6480
RUN chown -R node /app
COPY . .
USER root
CMD ["yarn", "tsx", "./index.ts"]
