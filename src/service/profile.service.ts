import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationRequest } from 'src/common/pagination/pagination-request';
import { GetMyProfileDto } from 'src/dto/get-my-profile';
import { GetOthersProfileDto } from 'src/dto/get-others-profile';
import { GetFeedResponseDto } from 'src/dto/response/get-feed.response.dto';
import { GetProfileEmojiListInfo, GetProfileHashTagListInfo, GetProfilePostDto, GetProfilePostList } from 'src/dto/response/profile/get-profile-post.dto';
import { FeedImage } from 'src/entity/feed_image.entity';
import { Member } from 'src/entity/member.entity';
import { FeedEmojiQueryRepository } from 'src/repository/feed-emoji.query-repository';
import { FollowQueryRepository } from 'src/repository/follow.query-repository';
import { MemberQueryRepository } from 'src/repository/member.query-repository';
import { PostEmojiQueryRepository } from 'src/repository/post-emoji.query-repository';
import { PostHashTagQueryRepository } from 'src/repository/post-hash-tag.query-repository';
import { PostQueryRepository } from 'src/repository/post.query-repository';
import { ProfileQueryRepository } from 'src/repository/profile.query-repository';
import { Repository } from 'typeorm';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Member) private readonly memberRepository: Repository<Member>,
    @InjectRepository(FeedImage) private readonly feedImageRepository: Repository<FeedImage>,
    private readonly memberQueryRepository: MemberQueryRepository,
    private readonly profileQueryRepository: ProfileQueryRepository,
    private readonly postQueryRepository: PostQueryRepository,
    private readonly followQueryRepository: FollowQueryRepository,
    private readonly postHashTagQueryRepository: PostHashTagQueryRepository,
    private readonly postEmojiQueryRepository: PostEmojiQueryRepository,
    private readonly feedEmojiQueryRepository: FeedEmojiQueryRepository,
  ) { }

  async getOthersProfileInfo(memberId: number, myMemberId: number): Promise<GetOthersProfileDto> {
    const isDeletedUser = await this.memberQueryRepository.getMemberIsNotDeletedById(memberId);
    if (!isDeletedUser) {
      throw new GoneException('탈퇴한 유저입니다.');
    }
    const othersProfileInfo = await this.profileQueryRepository.getOthersProfileInfo(memberId, myMemberId);
    const othersFollowerCount = await this.followQueryRepository.getFollowerCountByMemberId(memberId);
    const othersFollowingCount = await this.followQueryRepository.getProfileFollowingCountByMemberId(memberId);

    othersProfileInfo.followerCount = othersFollowerCount;
    othersProfileInfo.followingCount = othersFollowingCount;

    return GetOthersProfileDto.from(othersProfileInfo);
  }

  async getMyProfileInfo(memberId: number): Promise<GetMyProfileDto> {
    const myProfileInfo = await this.profileQueryRepository.getMyProfileInfo(memberId);
    const myFollowerCount = await this.followQueryRepository.getFollowerCountByMemberId(memberId);
    const myFollowingCount = await this.followQueryRepository.getProfileFollowingCountByMemberId(memberId);

    myProfileInfo.followerCount = myFollowerCount;
    myProfileInfo.followingCount = myFollowingCount;

    return GetMyProfileDto.from(myProfileInfo);
  }

  async modifyMyProfile(memberId: number, nickname: string, profileImageUrl: string, introduce: string): Promise<void> {
    const memberInfo = await this.memberRepository.findOneBy({ id: memberId });
    if (!memberInfo) {
      throw new NotFoundException('해당 사용자를 찾을 수 없습니다.');
    }
    memberInfo.setProfileInfo(nickname, profileImageUrl, introduce);
    await this.memberRepository.save(memberInfo);
  }

  async getMyPostList(memberId: number, paginationRequest: PaginationRequest) {
    const postListTuples = await this.profileQueryRepository.getPostList(memberId, paginationRequest, memberId);
    const totalCount = await this.profileQueryRepository.getAllPostListTotalCount(memberId, memberId);

    const postInfo = await Promise.all(
      postListTuples.map(async (postList) => {
        const hashTagInfo = await this.postHashTagQueryRepository.getPostHashTag(postList.postId);
        const postListEmojiInfo = await this.postEmojiQueryRepository.getPostEmoji(postList.postId, memberId);
        const post = GetProfilePostList.from(postList, hashTagInfo, postListEmojiInfo);

        return new GetProfilePostDto(post);
      }),
    );

    return { postInfo, totalCount };
  }

  async getOthersPostList(memberId: number, paginationRequest: PaginationRequest, myId: number) {
    const postListTuples = await this.profileQueryRepository.getPostList(memberId, paginationRequest, myId);
    const totalCount = await this.profileQueryRepository.getAllPostListTotalCount(memberId, myId);

    const postInfo = await Promise.all(
      postListTuples.map(async (postList) => {
        const hashTagInfo = await this.postHashTagQueryRepository.getPostHashTag(postList.postId);
        const postListEmojiInfo = await this.postEmojiQueryRepository.getPostEmoji(postList.postId, myId);
        const post = GetProfilePostList.from(postList, hashTagInfo, postListEmojiInfo);

        return new GetProfilePostDto(post);
      }),
    );

    return { postInfo, totalCount };
  }

  async getMyFeedList(
    memberId: number,
    paginationRequest: PaginationRequest,
  ): Promise<{ feedList: GetFeedResponseDto[]; totalCount: number }> {
    const getFeedListTuple = await this.profileQueryRepository.getFeedList(memberId, paginationRequest);
    const totalCount = await this.profileQueryRepository.getFeedListCount(memberId);

    const feedList = await Promise.all(
      getFeedListTuple.map(async (item) => {
        const writer = {
          id: item.writerId,
          nickname: item.writerNickname,
          generation: item.writerGeneration,
          profileImageUrl: item.writerProfileImageUrl,
        };

        const feedImages = await this.feedImageRepository.findBy({ feedId: item.feedId });
        const feedEmojis = await this.feedEmojiQueryRepository.getFeedEmoji(item.feedId, memberId);
        const feed = {
          id: item.feedId,
          content: item.feedContent,
          viewCount: item.feedViewCount,
          commentCount: item.feedCommentCount,
          emojiCount: item.feedEmojiCount,
          createdAt: item.feedCreatedAt,
          imageUrls: feedImages.map((feedImage) => feedImage.imageUrl),
          emojis: feedEmojis.map((emoji) => ({
            emojiCode: emoji.emojiCode,
            emojiCount: emoji.emojiCount,
            isClicked: emoji.isClicked
          }))
        };

        return GetFeedResponseDto.from({ writer, feed });
      }),
    );

    return { feedList, totalCount };
  }

  async getOthersFeedList(
    memberId: number,
    paginationRequest: PaginationRequest,
    myId: number,
  ): Promise<{ feedList: GetFeedResponseDto[]; totalCount: number }> {
    const getFeedListTuple = await this.profileQueryRepository.getFeedList(memberId, paginationRequest);
    const totalCount = await this.profileQueryRepository.getFeedListCount(memberId);

    const feedList = await Promise.all(
      getFeedListTuple.map(async (item) => {
        const writer = {
          id: item.writerId,
          nickname: item.writerNickname,
          generation: item.writerGeneration,
          profileImageUrl: item.writerProfileImageUrl,
        };

        const feedImages = await this.feedImageRepository.findBy({ feedId: item.feedId });
        const feedEmojis = await this.feedEmojiQueryRepository.getFeedEmoji(item.feedId, myId);
        const feed = {
          id: item.feedId,
          content: item.feedContent,
          viewCount: item.feedViewCount,
          commentCount: item.feedCommentCount,
          emojiCount: item.feedEmojiCount,
          createdAt: item.feedCreatedAt,
          imageUrls: feedImages.map((feedImage) => feedImage.imageUrl),
          emojis: feedEmojis.map((emoji) => ({
            emojiCode: emoji.emojiCode,
            emojiCount: emoji.emojiCount,
            isClicked: emoji.isClicked
          }))
        };

        return GetFeedResponseDto.from({ writer, feed });
      }),
    );

    return { feedList, totalCount };
  }

  async getMyScrapList(memberId: number, paginationRequest: PaginationRequest) {
    const postListTuples = await this.profileQueryRepository.getScrapedPostList(memberId, paginationRequest);
    const totalCount = await this.profileQueryRepository.getAllScrapedPostListTotalCount(memberId);

    const postInfo = await Promise.all(
      postListTuples.map(async (postList) => {
        const hashTagInfo = await this.postHashTagQueryRepository.getPostHashTag(postList.postId);
        const postListEmojiInfo = await this.postEmojiQueryRepository.getPostEmoji(postList.postId, memberId);
        const post = GetProfilePostList.from(postList, hashTagInfo, postListEmojiInfo);

        return new GetProfilePostDto(post);
      }),
    );
    return { postInfo, totalCount };
  }
}

export class ProfilePostWriterDto {
  id: number;
  nickname: string;
  generation: number;
  profileImageUrl: string;
}

export class ProfilePostListDto {
  id: number;
  category: string;
  title: string;
  content: string;
  viewCount: number;
  commentCount: number;
  emojiCount: number;
  createdAt: Date;
  isScraped: boolean;
  hashTags: GetProfileHashTagListInfo[];
  emojis: GetProfileEmojiListInfo[];
}