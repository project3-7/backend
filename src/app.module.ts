import { Logger, Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { AppService } from './service/app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TypeORMConfigService } from 'src/database/database.config';

import { CommonModule } from './common/common.module';

import { PassportModule } from '@nestjs/passport';
import { SessionSerializerService } from './service/session-serializer.service';
import { RolesGuard } from './guard/roles.guard';
import { MemberQueryRepository } from './repository/member.query-repository';
import { GithubAuthGuard } from './guard/github-auth.guard';
import { GithubStrategy } from './strategy/github-strategy';
import { OauthAuthenticationController } from './controller/oauth.controller';
import { OauthAuthenticationService } from './service/oauth-authentication.service';
import { Member } from './entity/member.entity';
import { FeedService } from './service/feed.service';
import { FeedController } from './controller/feed.controller';
import { Feed } from './entity/feed.entity';
import { FeedQueryRepository } from './repository/feed.query-repository';
import { Post } from './entity/post.entity';
import { PostHashTag } from './entity/post_hash_tag.entity';
import { HashTag } from './entity/hash_tag.entity';
import { PostService } from './service/post.service';
import { PostController } from './controller/post.controller';
import { Follow } from './entity/follow.entity';
import { PostQueryRepository } from './repository/post.query-repository';
import { FeedComment } from './entity/feed_comment.entity';
import { FeedCommentController } from './controller/feed-comment.controller';
import { FeedCommentService } from './service/feed-comment.service';
import { FeedCommentQueryRepository } from './repository/feed-comment.query-repository';
import { FeedCommentHeart } from './entity/feed_comment_heart';
import { PostCommentQueryRepository } from './repository/post-comment.query-repository';
import { PostCommentService } from './service/post-comment.service';
import { PostCommentController } from './controller/post-comment.controller';
import { PostComment } from './entity/post_comment.entity';
import { PostCommentHeart } from './entity/post_comment_heart.entity';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: TypeORMConfigService,
    }),
    TypeOrmModule.forFeature([
      Member,
      Feed,
      FeedComment,
      FeedCommentHeart,
      Post,
      PostComment,
      PostCommentHeart,
      PostHashTag,
      HashTag,
      Follow
    ]),
    PassportModule.register({
      session: true,
    }),
  ],
  controllers: [
    AppController,
    OauthAuthenticationController,
    FeedController,
    FeedCommentController,
    PostController,
    PostCommentController,
  ],
  providers: [
    // Service
    AppService,
    SessionSerializerService,
    OauthAuthenticationService,
    FeedService,
    FeedCommentService,
    PostService,
    PostCommentService,

    // QueryRepository
    MemberQueryRepository,
    FeedQueryRepository,
    FeedCommentQueryRepository,
    PostQueryRepository,
    PostCommentQueryRepository,

    // Strategy
    GithubStrategy,

    // Guard
    GithubAuthGuard,
    RolesGuard,

    // ETC
    Logger,
  ],
})
export class AppModule { }
