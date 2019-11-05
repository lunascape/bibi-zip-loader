use encoding_rs::SHIFT_JIS;
use libflate;
use podio::{LittleEndian, ReadPodExt};
use std::io;
use std::io::prelude::*;
use std::string::FromUtf8Error;

#[derive(Debug)]
pub struct EOCD {
    pub signature: u32,
    pub number_of_this_disk: u16,
    pub number_of_disk_start_eocd: u16,
    pub total_number_of_entries_on_disk: u16,
    pub total_number_of_entries_in_cd: u16,
    pub cd_size: u32,
    pub cd_offset: u32,
    pub comment: Vec<u8>,

    pub eocd_offset: u32,
    pub eocd_size: u32,
}

#[derive(Debug)]
pub struct CDHeader {
    pub signature: u32,
    pub version_made_by: u16,
    pub version_needed_to_extract: u16,
    pub general_purpose_bit_flag: u16,
    pub compression_method: u16,
    pub last_mod_file_time: u16,
    pub last_mod_file_date: u16,
    pub crc32: u32,
    pub compressed_size: u32,
    pub uncompressed_size: u32,
    pub file_name_length: u16,
    pub extra_field_length: u16,
    pub file_comment_length: u16,
    pub disk_number_start: u16,
    pub internal_file_attributes: u16,
    pub external_file_attributes: u32,
    pub relative_offset_of_local_header: u32,

    pub file_name: String,
    pub extra_field: Vec<u8>,
    pub file_comment: Vec<u8>,

    pub is_utf8: bool,
    pub is_encrypted: bool,
}

pub const LFH_SIGNATURE: u32 = 0x04034b50;
pub const CD_SIGNATURE: u32 = 0x02014b50;
pub const EOCD_SIGNATURE: u32 = 0x06054b50;
// pub const ZIP64_EOCD_SIGNATURE : u32 = 0x06064b50;
// const ZIP64_CENTRAL_DIRECTORY_END_LOCATOR_SIGNATURE : u32 = 0x07064b50;

pub const COMPRESSION_METHOD_STORED: u16 = 0;
pub const COMPRESSION_METHOD_DEFLATED: u16 = 8;

#[derive(Debug)]
pub enum ParseEOCDError {
    TooShortDataLength,
    InvalidSignature,
    IOError(io::Error),
}

#[derive(Debug)]
pub enum ParseCDError {
    InvalidSignature,
    FileNameConversionError,
    IOError(io::Error),
}

#[derive(Debug)]
pub enum LoadFileError {
    InvalidSignature,
    FileNameConversionError,
    UnmatchHeader,
    UnsupportedCompressionMethod(u16),
    IOError(io::Error),
}

#[derive(Debug)]
enum FileNameError {
    FromUtf8Error,
    FromSJISError,
}

pub fn parse_eocd(cursor: &mut io::Cursor<Vec<u8>>) -> Result<EOCD, ParseEOCDError> {
    let length = cursor.seek(io::SeekFrom::End(0))?;
    if length < 22 {
        return Result::Err(ParseEOCDError::TooShortDataLength);
    }
    let mut signature: u32;
    cursor.seek(io::SeekFrom::End(-22))?;
    loop {
        signature = cursor.read_u32::<LittleEndian>()?;
        if signature == EOCD_SIGNATURE {
            break;
        }
        cursor.seek(io::SeekFrom::Current(-5))?;
    }
    let eocd_offset = cursor.position() as u32 - 4;

    let number_of_this_disk = cursor.read_u16::<LittleEndian>()?;
    let number_of_disk_start_eocd = cursor.read_u16::<LittleEndian>()?;
    let total_number_of_entries_on_disk = cursor.read_u16::<LittleEndian>()?;
    let total_number_of_entries_in_cd = cursor.read_u16::<LittleEndian>()?;
    let cd_size = cursor.read_u32::<LittleEndian>()?;
    let cd_offset = cursor.read_u32::<LittleEndian>()?;
    let comment_length = cursor.read_u16::<LittleEndian>()? as usize;
    let comment = ReadPodExt::read_exact(cursor, comment_length)?;

    let eocd_size = 4 + 2 + 2 + 2 + 2 + 4 + 4 + 2 + comment_length as u32;

    let eocd = EOCD {
        signature: signature,
        number_of_this_disk: number_of_this_disk,
        number_of_disk_start_eocd: number_of_disk_start_eocd,
        total_number_of_entries_on_disk: total_number_of_entries_on_disk,
        total_number_of_entries_in_cd: total_number_of_entries_in_cd,
        cd_size: cd_size,
        cd_offset: cd_offset,
        comment: comment,
        eocd_offset: eocd_offset,
        eocd_size: eocd_size,
    };
    Result::Ok(eocd)
}

pub fn parse_cd(
    cursor: &mut io::Cursor<Vec<u8>>,
    count: usize,
) -> Result<Vec<CDHeader>, ParseCDError> {
    let mut cdhs: Vec<CDHeader> = Vec::with_capacity(count);
    while cdhs.len() < count {
        let signature = cursor.read_u32::<LittleEndian>()?;
        if signature != CD_SIGNATURE {
            return Result::Err(ParseCDError::InvalidSignature);
        }

        let version_made_by = cursor.read_u16::<LittleEndian>()?;
        let version_needed_to_extract = cursor.read_u16::<LittleEndian>()?;
        let general_purpose_bit_flag = cursor.read_u16::<LittleEndian>()?;
        let compression_method = cursor.read_u16::<LittleEndian>()?;
        let last_mod_file_time = cursor.read_u16::<LittleEndian>()?;
        let last_mod_file_date = cursor.read_u16::<LittleEndian>()?;
        let crc32 = cursor.read_u32::<LittleEndian>()?;
        let compressed_size = cursor.read_u32::<LittleEndian>()?;
        let uncompressed_size = cursor.read_u32::<LittleEndian>()?;
        let file_name_length = cursor.read_u16::<LittleEndian>()?;
        let extra_field_length = cursor.read_u16::<LittleEndian>()?;
        let file_comment_length = cursor.read_u16::<LittleEndian>()?;
        let disk_number_start = cursor.read_u16::<LittleEndian>()?;
        let internal_file_attributes = cursor.read_u16::<LittleEndian>()?;
        let external_file_attributes = cursor.read_u32::<LittleEndian>()?;
        let relative_offset_of_local_header = cursor.read_u32::<LittleEndian>()?;
        let file_name_bytes = ReadPodExt::read_exact(cursor, file_name_length as usize)?;
        let extra_field = ReadPodExt::read_exact(cursor, extra_field_length as usize)?;
        let file_comment = ReadPodExt::read_exact(cursor, file_comment_length as usize)?;

        let is_utf8 = general_purpose_bit_flag & (1 << 11) != 0;
        let is_encrypted = general_purpose_bit_flag & 1 == 1;

        let file_name = decode_file_name(&file_name_bytes, is_utf8)?;

        let cdh = CDHeader {
            signature: signature,
            version_made_by: version_made_by,
            version_needed_to_extract: version_needed_to_extract,
            general_purpose_bit_flag: general_purpose_bit_flag,
            compression_method: compression_method,
            last_mod_file_time: last_mod_file_time,
            last_mod_file_date: last_mod_file_date,
            crc32: crc32,
            compressed_size: compressed_size,
            uncompressed_size: uncompressed_size,
            file_name_length: file_name_length,
            extra_field_length: extra_field_length,
            file_comment_length: file_comment_length,
            disk_number_start: disk_number_start,
            internal_file_attributes: internal_file_attributes,
            external_file_attributes: external_file_attributes,
            relative_offset_of_local_header: relative_offset_of_local_header,
            file_name: file_name,
            extra_field: extra_field,
            file_comment: file_comment,
            is_utf8: is_utf8,
            is_encrypted: is_encrypted,
        };
        cdhs.push(cdh);
    }

    Result::Ok(cdhs)
}

pub fn load_file(
    mut cursor: io::Cursor<Vec<u8>>,
    cdh: &CDHeader,
) -> Result<Vec<u8>, LoadFileError> {
    let signature = cursor.read_u32::<LittleEndian>()?;
    if signature != LFH_SIGNATURE {
        return Result::Err(LoadFileError::UnmatchHeader);
    }
    cursor.seek(io::SeekFrom::Current(2))?;
    let general_purpose_bit_flag = cursor.read_u16::<LittleEndian>()?;
    let compression_method = cursor.read_u16::<LittleEndian>()?;

    cursor.seek(io::SeekFrom::Current(4))?;
    let mut crc32 = cursor.read_u32::<LittleEndian>()?;
    let mut compressed_size = cursor.read_u32::<LittleEndian>()?;
    let mut uncompressed_size = cursor.read_u32::<LittleEndian>()?;

    let file_name_length = cursor.read_u16::<LittleEndian>()?;
    let extra_field_length = cursor.read_u16::<LittleEndian>()?;
    let file_name_bytes = ReadPodExt::read_exact(&mut cursor, file_name_length as usize)?;
    cursor.seek(io::SeekFrom::Current(extra_field_length as i64))?;

    let is_encrypted = general_purpose_bit_flag & 1 == 1;
    let is_utf8 = general_purpose_bit_flag & (1 << 11) != 0;
    let use_fd = general_purpose_bit_flag & (1 << 3) != 0;

    let file_name = decode_file_name(&file_name_bytes, is_utf8)?;

    if use_fd {
        let position = cursor.position();
        cursor.seek(io::SeekFrom::End(-12))?;
        crc32 = cursor.read_u32::<LittleEndian>()?;
        compressed_size = cursor.read_u32::<LittleEndian>()?;
        uncompressed_size = cursor.read_u32::<LittleEndian>()?;
        cursor.set_position(position);
    }

    if file_name != cdh.file_name
        || crc32 != cdh.crc32
        || is_encrypted != cdh.is_encrypted
        || compressed_size != cdh.compressed_size
        || uncompressed_size != cdh.uncompressed_size
    {
        console_log!("crc32: {} vs {}", crc32, cdh.crc32);
        console_log!("file_name: {} vs {}", file_name, cdh.file_name);
        console_log!("is_encrypted: {} vs {}", is_encrypted, cdh.is_encrypted);
        console_log!("compressed_size: {} vs {}", compressed_size, cdh.compressed_size);
        console_log!("uncompressed_size: {} vs {}", uncompressed_size, cdh.uncompressed_size);

        return Result::Err(LoadFileError::UnmatchHeader);
    }

    let start = cursor.position() as usize;
    let end = start + compressed_size as usize;
    let data = cursor.into_inner();
    let data = data[start..end].to_vec();

    match compression_method {
        COMPRESSION_METHOD_STORED => Result::Ok(data),
        COMPRESSION_METHOD_DEFLATED => {
            let cursor = io::Cursor::new(data);
            let mut decoder = libflate::deflate::Decoder::new(cursor);
            let mut buf = Vec::with_capacity(uncompressed_size as usize);
            decoder.read_to_end(&mut buf)?;
            Result::Ok(buf)
        }
        _ => Result::Err(LoadFileError::UnsupportedCompressionMethod(
            compression_method,
        )),
    }
}

fn decode_file_name(buf: &Vec<u8>, is_utf8: bool) -> Result<String, FileNameError> {
    if is_utf8 {
        Result::Ok(String::from_utf8(buf.clone())?)
    } else {
        let (res, _enc, errors) = SHIFT_JIS.decode(buf.as_slice());
        if errors {
            return Result::Err(FileNameError::FromSJISError);
        }
        Result::Ok(res.into_owned())
    }
}

impl From<io::Error> for ParseEOCDError {
    fn from(error: io::Error) -> Self {
        ParseEOCDError::IOError(error)
    }
}

impl From<io::Error> for ParseCDError {
    fn from(error: io::Error) -> Self {
        ParseCDError::IOError(error)
    }
}

impl From<FromUtf8Error> for FileNameError {
    fn from(_error: FromUtf8Error) -> Self {
        FileNameError::FromUtf8Error
    }
}

impl From<FileNameError> for ParseCDError {
    fn from(_: FileNameError) -> Self {
        ParseCDError::FileNameConversionError
    }
}

impl From<io::Error> for LoadFileError {
    fn from(error: io::Error) -> Self {
        LoadFileError::IOError(error)
    }
}

impl From<FileNameError> for LoadFileError {
    fn from(_: FileNameError) -> Self {
        LoadFileError::FileNameConversionError
    }
}