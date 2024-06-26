import {
  BadRequestException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HashTagDto } from 'src/dto/hash-tag-dto';
import { CreatePostInfoDto } from 'src/dto/request/create-post-dto';
import { HashTag } from 'src/entity/hash_tag.entity';
import { Member } from 'src/entity/member.entity';
import { Post } from 'src/entity/post.entity';
import { PostHashTag } from 'src/entity/post_hash_tag.entity';
import { Repository } from 'typeorm';
import { SortPostList } from 'src/dto/request/sort-post-list.request';
import { PostQueryRepository } from 'src/repository/post.query-repository';
import { GetEmojiListInfo, GetHashTagListInfo, GetPostList, GetPostListDto } from 'src/dto/get-post-list.dto';
import { GetEmojiDetailInfo, GetHashTagDetailInfo, GetPostDetail, GetPostDetailDto } from 'src/dto/get-post-detail.dto';
import { ListSortBy, NotificationType } from 'src/entity/common/Enums';
import { PostView } from 'src/entity/post_view.entity';
import { PostComment } from 'src/entity/post_comment.entity';
import { PostCommentHeart } from 'src/entity/post_comment_heart.entity';
import { PaginationRequest } from 'src/common/pagination/pagination-request';
import { GetPostCommentList } from 'src/dto/get-post-comment-list.dto';
import { HashTagSearchRequest } from 'src/dto/request/hash-tag-search.request';
import { GetHashTagSearch } from 'src/dto/get-hash-tag-search.dto';
import { PostEmoji } from 'src/entity/post_emoji.entity';
import { MemberQueryRepository } from 'src/repository/member.query-repository';
import { Notification } from 'src/entity/notification.entity';
import { CreatePostResponse } from 'src/dto/response/create-post.response';
import { PostEmojiQueryRepository } from 'src/repository/post-emoji.query-repository';
import { PostHashTagQueryRepository } from 'src/repository/post-hash-tag.query-repository';
import { PostCommentQueryRepository } from 'src/repository/post-comment.query-repository';
import { PostDomainService } from 'src/domain-service/post.domain-service';
import { TodayQuestionResponse } from 'src/dto/response/today-question.response';
import { NotificationDomainService } from 'src/domain-service/notification.domain-service';
import { MemberDomainService } from 'src/domain-service/member.domain-service';
import { PostScrap } from 'src/entity/post_scrap.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post) private readonly postRepository: Repository<Post>,
    @InjectRepository(Member) private readonly memberRepository: Repository<Member>,
    @InjectRepository(HashTag) private readonly hashTagRepository: Repository<HashTag>,
    @InjectRepository(PostHashTag) private readonly postHashTagRepository: Repository<PostHashTag>,
    @InjectRepository(PostView) private readonly postViewRepository: Repository<PostView>,
    @InjectRepository(PostComment) private readonly postCommentRepository: Repository<PostComment>,
    @InjectRepository(PostCommentHeart) private readonly postCommentHeartRepository: Repository<PostCommentHeart>,
    @InjectRepository(PostEmoji) private readonly postEmojiRepository: Repository<PostEmoji>,
    @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(PostScrap) private readonly postScrapRepository: Repository<PostScrap>,
    private readonly postQueryRepository: PostQueryRepository,
    private readonly postCommentQueryRepository: PostCommentQueryRepository,
    private readonly memberQueryRepository: MemberQueryRepository,
    private readonly postHashTagQueryRepository: PostHashTagQueryRepository,
    private readonly postEmojiQueryRepository: PostEmojiQueryRepository,
    private readonly postDomainService: PostDomainService,
    private readonly memberDomainService: MemberDomainService,
    private readonly notificationDomainService: NotificationDomainService,
  ) { }

  async createPost(memberId: number, dto: CreatePostInfoDto): Promise<CreatePostResponse> {
    const member = await this.memberRepository.findOneBy({ id: memberId });
    if (member === null) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    const post = await this.postRepository.save({
      memberId,
      category: dto.category,
      title: dto.title,
      content: dto.content,
    });
    await this.saveHashTags(post.id, dto.hashTags);

    return new CreatePostResponse(post.id);
  }

  async getPostList(memberId: number, userGeneration: number, sortPostList: SortPostList) {
    const sortBy = sortPostList.sortBy;
    if (typeof memberId === 'undefined' && (sortBy === ListSortBy.BY_FOLLOW || sortBy === ListSortBy.BY_GENERATION)) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }
    const sortCategory = sortPostList.category;
    const postListTuples = await this.postQueryRepository.getPostList(
      memberId,
      sortPostList,
      sortBy,
      sortCategory,
      userGeneration,
    );
    const totalCount = await this.postQueryRepository.getAllPostListTotalCount(
      memberId,
      sortPostList,
      sortBy,
      sortCategory,
      userGeneration,
    );

    const postInfo = await Promise.all(
      postListTuples.map(async (postList) => {
        const hashTagInfo = await this.postHashTagQueryRepository.getPostHashTag(postList.postId);
        const postListEmojiInfo = await this.postEmojiQueryRepository.getPostEmoji(postList.postId, memberId);
        const post = GetPostList.from(postList, hashTagInfo, postListEmojiInfo);

        return new GetPostListDto(post);
      }),
    );

    return { postInfo, totalCount };
  }

  async getPostDetail(postId: number, memberId: number): Promise<GetPostDetailDto> {
    await this.postDomainService.getPostIsNotDeleted(postId);
    const postDetailInfo = await this.postQueryRepository.getPostDetail(postId, memberId);

    if (postDetailInfo.memberDeletedAt !== null) {
      throw new GoneException('해당 글 작성자가 존재하지 않습니다.');
    }

    const postDetailHashTagInfo = await this.postHashTagQueryRepository.getPostHashTag(postId);
    const postDetailEmojiInfo = await this.postEmojiQueryRepository.getPostEmoji(postId, memberId);
    const postDetail = GetPostDetail.from(postDetailInfo, postDetailHashTagInfo, postDetailEmojiInfo);

    return new GetPostDetailDto(postDetail);
  }

  async modifyPost(postId: number, memberId: number, dto: CreatePostInfoDto): Promise<void> {
    const postInfo = await this.postDomainService.getPostIsNotDeleted(postId);

    if (postInfo.memberId !== memberId) {
      throw new UnauthorizedException('권한이 없습니다.');
    }
    const hashTags = await this.postHashTagRepository.findBy({ postId });

    postInfo.setPostInfo(dto.category, dto.title, dto.content);
    await this.postRepository.save(postInfo);

    await Promise.all(hashTags.map((tag) => this.postHashTagRepository.remove(tag)));
    await this.saveHashTags(postInfo.id, dto.hashTags);
  }

  async deletePost(postId: number, memberId: number): Promise<void> {
    const postInfo = await this.postDomainService.getPostIsNotDeleted(postId);
    if (postInfo.memberId !== memberId) {
      throw new UnauthorizedException('권한이 없습니다.');
    }

    postInfo.deletePostInfo(new Date());
    await this.postRepository.save(postInfo);
  }

  async createPostEmoji(postId: number, memberId: number, emoji: string) {
    const postInfo = await this.postDomainService.getPostIsNotDeleted(postId);

    postInfo.plusEmojiCount(postInfo.emojiCount);
    await this.postRepository.save(postInfo);

    await this.postEmojiRepository.save({
      postId,
      memberId,
      emoji,
    });

    await this.postEmojiNotification(postInfo.memberId, memberId, postId);
  }

  async removePostEmoji(postId: number, memberId: number, emojiCode: string) {
    const postInfo = await this.postDomainService.getPostIsNotDeleted(postId);

    const emojiInfo = await this.postEmojiRepository.findOneBy({ postId, memberId, emoji: emojiCode });
    if (!emojiInfo) {
      throw new NotFoundException('해당 이모지를 찾을 수 없습니다.');
    }
    if (emojiInfo.memberId !== memberId) {
      throw new UnauthorizedException('삭제 권한이 없습니다.');
    }

    postInfo.minusEmojiCount(postInfo.emojiCount);
    await this.postRepository.save(postInfo);

    await this.postEmojiRepository.remove(emojiInfo);
  }

  async increasePostViewCount(postId: number, memberId: number): Promise<void> {
    const postInfo = await this.postDomainService.getPostIsNotDeleted(postId);

    if (memberId === postInfo.memberId) {
      return;
    }

    await this.postViewRepository.save({ postId, memberId });

    postInfo.plusPostViewCount(postInfo.viewCount);
    await this.postRepository.save(postInfo);
  }

  async getPostCommentList(postId: number, memberId: number, paginationRequest: PaginationRequest) {
    const postCommentList = await this.postCommentQueryRepository.getPostCommentList(
      postId,
      memberId,
      paginationRequest,
    );
    const totalCount = await this.postCommentQueryRepository.getPostCommentListCount(postId);

    const postCommentInfo = postCommentList.map((commentList) => GetPostCommentList.from(commentList));
    return { postCommentInfo, totalCount };
  }

  async writePostComment(postId: number, memberId: number, content: string): Promise<void> {
    const postInfo = await this.postDomainService.getPostIsNotDeleted(postId);
    postInfo.plusCommentCount(postInfo.commentCount);
    await this.postRepository.save(postInfo);
    const comment = await this.postCommentRepository.save({
      postId: postId,
      memberId: memberId,
      content: content,
    });

    this.newPostCommentNotification(postInfo.memberId, memberId, postId, comment.id);
  }

  async patchPostComment(postId: number, commentId: number, memberId: number, content: string): Promise<void> {
    await this.postDomainService.getPostIsNotDeleted(postId);

    const commentInfo = await this.postCommentRepository.findOneBy({ id: commentId, postId });
    if (!commentInfo) {
      throw new NotFoundException('해당 댓글을 찾을 수 없습니다.');
    }
    if (commentInfo.memberId !== memberId) {
      throw new UnauthorizedException('접근 권한이 없습니다.');
    }
    if (commentInfo.deletedAt !== null) {
      throw new GoneException('해당 댓글은 삭제되었습니다.');
    }

    commentInfo.setCommentInfo(content);
    await this.postCommentRepository.save(commentInfo);
  }

  async deletePostComment(postId: number, commentId: number, memberId: number): Promise<void> {
    const postInfo = await this.postDomainService.getPostIsNotDeleted(postId);
    const commentInfo = await this.postCommentRepository.findOneBy({ id: commentId, postId });
    if (!commentInfo) {
      throw new NotFoundException('해당 댓글을 찾을 수 없습니다.');
    }
    if (commentInfo.memberId !== memberId) {
      throw new UnauthorizedException('접근 권한이 없습니다.');
    }
    if (commentInfo.deletedAt !== null) {
      throw new GoneException('해당 댓글은 삭제되었습니다.');
    }

    postInfo.minusCommentCount(postInfo.commentCount);
    await this.postRepository.save(postInfo);

    commentInfo.deleteCommentInfo(new Date());
    await this.postCommentRepository.save(commentInfo);
  }

  async heartPostComment(postId: number, commentId: number, memberId: number): Promise<void> {
    await this.postDomainService.getPostIsNotDeleted(postId);
    const commentInfo = await this.postCommentRepository.findOneBy({ id: commentId, postId });
    if (!commentInfo) {
      throw new NotFoundException('해당 댓글을 찾을 수 없습니다.');
    }
    if (commentInfo.deletedAt !== null) {
      throw new GoneException('해당 댓글은 삭제되었습니다.');
    }
    commentInfo.plusCommentHeartCount(commentInfo.heartCount);
    await this.postCommentRepository.save(commentInfo);

    await this.postCommentHeartRepository.save({ commentId, memberId });
  }

  async deletePostCommentHeart(postId: number, commentId: number, memberId: number) {
    await this.postDomainService.getPostIsNotDeleted(postId);
    const commentInfo = await this.postCommentRepository.findOneBy({ id: commentId, postId });
    if (!commentInfo) {
      throw new NotFoundException('해당 댓글을 찾을 수 없습니다.');
    }
    if (commentInfo.deletedAt !== null) {
      throw new GoneException('해당 댓글은 삭제되었습니다.');
    }
    const commentHeartInfo = await this.postCommentHeartRepository.findOneBy({ commentId, memberId });
    if (!commentHeartInfo) {
      throw new NotFoundException('해당 댓글 좋아요를 찾을 수 없습니다.');
    }
    commentInfo.minusCommentHeartCount(commentInfo.heartCount);
    await this.postCommentRepository.save(commentInfo);
    await this.postCommentHeartRepository.remove(commentHeartInfo);
  }

  async getHashTagSearchInfo(hashTagResult: HashTagSearchRequest) {
    const hashTagSearchTuples = await this.postHashTagQueryRepository.getHashTagSearchList(hashTagResult);
    const hashTagSearchInfo = hashTagSearchTuples.map((hashTagSearch) => GetHashTagSearch.from(hashTagSearch));
    return hashTagSearchInfo;
  }

  async getTodayQuestion(): Promise<TodayQuestionResponse> {
    const randomQuestion = await this.postQueryRepository.getRandomQuestion();
    if (!randomQuestion) {
      return new TodayQuestionResponse(0, '');
    }
    return randomQuestion;
  }

  async postScrap(memberId: number, postId: number): Promise<void> {
    await this.postDomainService.getPostIsNotDeleted(postId);
    await this.memberDomainService.getMemberIsNotDeletedById(memberId);

    const scrap = await this.postScrapRepository.findOneBy({ postId, memberId });
    if (scrap) {
      throw new BadRequestException('이미 스크랩 중입니다.');
    }

    await this.postScrapRepository.save({
      postId,
      memberId,
    })
  }

  async deleteScrap(memberId: number, postId: number): Promise<void> {
    await this.postDomainService.getPostIsNotDeleted(postId);
    await this.memberDomainService.getMemberIsNotDeletedById(memberId);

    const scrap = await this.postScrapRepository.findOneBy({ postId, memberId });
    if (!scrap) {
      throw new NotFoundException('해당 스크랩이 존재하지 않습니다.');
    }
    await this.postScrapRepository.remove(scrap);
  }

  private async saveHashTags(postId: number, hashTags: HashTagDto[]): Promise<void> {
    await Promise.all(
      hashTags.map(async (hashTagDto, index) => {
        const hashTag = await this.hashTagRepository.findOneBy({ tagName: hashTagDto.tagName });
        let hashTagId = 0;
        if (!hashTag) {
          const newHashTag = await this.hashTagRepository.save({
            tagName: hashTagDto.tagName,
            color: hashTagDto.color,
          });
          hashTagId = newHashTag.id;
        } else {
          hashTagId = hashTag.id;
        }
        await this.postHashTagRepository.save({
          postId,
          hashTagId,
          order: index + 1
        });
      }),
    );
  }

  private async newPostCommentNotification(receivedMemberId, sendMemberId, postId, commentId) {
    const sendMember = await this.memberDomainService.getMemberIsNotDeletedById(sendMemberId);

    await this.notificationDomainService.saveNotification({
      receivedMemberId,
      sendMemberId,
      notificationType: {
        type: NotificationType.CREATE_POST_COMMENT,
        postId,
        commentId,
      },
      content: `${sendMember.nickname}님이 회원님의 포스트에 댓글을 남겼습니다.`,
    });
  }

  private async postEmojiNotification(receivedMemberId, sendMemberId, postId) {
    const sendMember = await this.memberDomainService.getMemberIsNotDeletedById(sendMemberId);

    await this.notificationDomainService.saveNotification({
      receivedMemberId,
      sendMemberId,
      notificationType: {
        type: NotificationType.CREATE_POST_EMOJI,
        postId,
      },
      content: `${sendMember.nickname}님이 회원님의 포스트에 이모지를 남겼습니다.`,
    });
  }
}

export class PostWriterDto {
  id: number;
  nickname: string;
  generation: number;
  profileImageUrl: string;
}

export class PostListDto {
  id: number;
  category: string;
  title: string;
  content: string;
  viewCount: number;
  commentCount: number;
  emojiCount: number;
  createdAt: Date;
  isScraped: boolean;
  hashTags: GetHashTagListInfo[];
  emojis: GetEmojiListInfo[];
}

export class PostDetailDto {
  id: number;
  category: string;
  title: string;
  content: string;
  viewCount: number;
  commentCount: number;
  emojiCount: number;
  createdAt: Date;
  isMine: boolean;
  isScraped: boolean;
  hashTags: GetHashTagDetailInfo[];
  emojis: GetEmojiDetailInfo[];

  constructor(
    id: number,
    category: string,
    title: string,
    content: string,
    viewCount: number,
    commentCount: number,
    emojiCount: number,
    createdAt: Date,
    isMine: boolean,
    isScraped: boolean,
    hashTags: GetHashTagDetailInfo[],
    emojis: GetEmojiDetailInfo[],
  ) {
    this.id = id;
    this.category = category;
    this.title = title;
    this.content = content;
    this.viewCount = viewCount;
    this.commentCount = commentCount;
    this.emojiCount = emojiCount;
    this.createdAt = createdAt;
    this.isMine = isMine;
    this.isScraped = isScraped;
    this.hashTags = hashTags;
    this.emojis = emojis;
  }
}

export class PostCommentWriterDto {
  id: number;
  nickname: string;
  generation: number;
  profileImageUrl: string;
}

export class PostCommentDto {
  id: number;
  content: string;
  heartCount: number;
  isHearted: boolean;
  createdAt: Date;
  isMine: boolean;
  isReplied: boolean;
}
