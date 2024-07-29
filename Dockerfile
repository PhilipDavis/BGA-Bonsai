# Why Docker? ...because I don't want to install PHP on my machine.
# This also makes it easy to test different versions of PHP by
# tweaking the image.
#
# First, build the image
# > docker build -t bonsaitest .
#
# Then, Run the tests
# > docker run -it --rm -v %cd%/modules:/var/bga bonsaitest
# (or just run test.bat)
#

FROM php:8.3-alpine
#FROM php:7.4-alpine

WORKDIR /var/php

ENV PATH="$PATH:/var/php"

# Install PHP extensions and other dependencies required by PHPUnit
RUN apk update && \
    apk add \
        php-cli \
        php-json \
        php-mbstring \
        php-xml \
        # Not found
        #php-pcov \
        # Note: remove php-xdebug for PHP 7
        php-xdebug \
    && echo Done

# PHP 7
#RUN wget -O phpunit.phar https://phar.phpunit.de/phpunit-7.phar && \
#    chmod +x phpunit.phar

RUN wget -O phpunit.phar https://phar.phpunit.de/phpunit-10.phar && \
    chmod +x phpunit.phar

WORKDIR /var/bga

# PHP 7
#CMD ["phpunit.phar", "--testdox", "modules/BonsaiLogicTest.php"]

CMD ["phpunit.phar", "--no-progress", "--testdox", "modules/BonsaiLogicTest.php"]
