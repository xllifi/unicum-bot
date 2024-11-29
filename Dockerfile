FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "yarn.lock", "./"]
RUN yarn
COPY . .
EXPOSE 6480
RUN chown -R node /app
USER node
CMD ["yarn", "dev"]
