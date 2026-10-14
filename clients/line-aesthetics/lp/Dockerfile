# Static host for the live Line Aesthetics landing pages (Railway, go.lineaestheticsclinic.com).
# Only approved pages are live on the clinic domain; drafts are served on the railway.app preview host only (see nginx.conf). Clinic images are pulled at build time because they are not stored in git.
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html
RUN rm -f index.html 50x.html && mkdir assets \
 && wget -q -O assets/logo.png https://d2ol7oe51mr4n9.cloudfront.net/user_33aOqIa4Dj3460IsxkUsQaAanU8/e7a7f600-f842-41fe-be64-1e4db55ec8a8.png \
 && wget -q -O assets/dr-ram-credentials.webp https://d2ol7oe51mr4n9.cloudfront.net/user_33aOqIa4Dj3460IsxkUsQaAanU8/3a02faff-6da9-46fa-b985-49f85f117d81.webp \
 && wget -q -O assets/dr-ram-suit.webp https://d2ol7oe51mr4n9.cloudfront.net/user_33aOqIa4Dj3460IsxkUsQaAanU8/54d40a07-2700-4bb7-a403-ad5f1776186c.webp
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY la.css la.js nose-thread-lift.html face-thread-lift.html ./
EXPOSE 80
