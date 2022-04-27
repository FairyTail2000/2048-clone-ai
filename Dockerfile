FROM node:17 as build

WORKDIR /app

COPY package.json .

RUN yarn install

COPY . .

RUN yarn build

FROM nginx

COPY temp.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
