# 基于 Node.js 20 的镜像
FROM --platform=linux/amd64 node:20.13.0

# 设置工作目录
WORKDIR /app

# 将 package.json 和 package-lock.json 复制到工作目录
COPY package*.json ./

# 安装依赖
RUN yarn install --production

# 将应用程序代码复制到工作目录
COPY . .

# 暴露端口（根据你的应用程序配置）
EXPOSE 3001

# 启动应用程序
CMD ["yarn", "backfill"]
