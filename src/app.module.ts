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

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: TypeORMConfigService,
    }),
    TypeOrmModule.forFeature([Member, Feed]),
    PassportModule.register({
      session: true,
    }),
  ],
  controllers: [AppController, OauthAuthenticationController, FeedController],
  providers: [
    // Service
    AppService,
    SessionSerializerService,
    OauthAuthenticationService,
    FeedService,

    // QueryRepository
    MemberQueryRepository,

    // Strategy
    GithubStrategy,

    // Guard
    GithubAuthGuard,
    RolesGuard,

    // ETC
    Logger,
  ],
})
export class AppModule {}
