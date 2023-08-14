FROM node:18.17.1-bullseye-slim
ARG DEBIAN_FRONTEND=noninteractive
ARG GROUP_NAME=node
ARG USER_NAME=node
ARG PASSWORD=node
ARG DOCKER_UID=1000
ARG DOCKER_GID=1000
ARG APP_DIR=/app
ARG PNPM_VERSION=8.6.9
ENV PNPM_HOME=/home/$USER_NAME/.local/share/pnpm
ENV PATH=$PATH:$PNPM_HOME
RUN apt-get update && apt-get install -y curl git sudo procps
RUN echo "$USER_NAME:$PASSWORD" | chpasswd && \
    usermod --append --groups sudo $USER_NAME && \
    echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
RUN mkdir -p $APP_DIR
RUN mkdir -p $APP_DIR/.pnpm-store
RUN mkdir -p $APP_DIR/node_modules
RUN chown $USER_NAME:$GROUP_NAME -R $APP_DIR
USER $USER_NAME
RUN curl -fsSL https://get.pnpm.io/install.sh | bash -
RUN pnpm i -g pnpm
WORKDIR $APP_DIR